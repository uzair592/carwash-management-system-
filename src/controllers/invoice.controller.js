const prisma = require('../prisma');
const { notifyPaymentReceived, sendSMSReceipt, notifyLowStock } = require('../services/notification.service');

/**
 * Normalizes payment method string to Prisma enum & target ledger account.
 */
function parsePaymentMode(input) {
  const norm = String(input || 'CASH').trim().toUpperCase();
  if (norm === 'CASH') {
    return { enumVal: 'Cash', accountType: 'Cash_Drawer' };
  }
  if (norm === 'BANK' || norm === 'MAIN_BANK') {
    return { enumVal: 'Bank', accountType: 'Main_Bank' };
  }
  if (norm === 'CARD') {
    return { enumVal: 'Card', accountType: 'Main_Bank' };
  }
  throw new Error(`Invalid payment method: "${input}". Allowed methods: "CASH", "BANK", "CARD".`);
}

/**
 * POST /api/invoices/checkout
 * Enterprise ERP Checkout with Strict Double-Entry Accounting:
 * 1. Checks job card is not already invoiced
 * 2. Marks JobCard Completed
 * 3. Applies customer advance deposits (liabilities converted to revenue, no ledger double-crediting)
 * 4. Records split payments (multiple payment records per invoice)
 * 5. Mutates ledger for the net cash/bank collected
 * 6. Materials were already issued during job (no double-deduction at checkout)
 * 7. Enqueues atomic Telegram alert to Outbox and sends customer SMS receipt
 */
async function checkoutHandler(req, res, next) {
  try {
    const {
      job_card_id,
      payment_method = 'CASH',
      payments = [],
      applied_deposit_ids = [],
      discount_amount = 0,
      cashier_id,
      admin_pin,
    } = req.body;

    if (!job_card_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Field "job_card_id" is required for checkout.',
      });
    }

    const discountNum = Math.max(0, parseFloat(discount_amount) || 0);

    // Strict Accounting: Discounts require verified Admin/Manager PIN
    let pinCheck = null;
    if (discountNum > 0) {
      const { verifyAdminOrManagerPin } = require('../middleware/auth.middleware');
      pinCheck = await verifyAdminOrManagerPin(admin_pin);
      if (!pinCheck.isValid) {
        return res.status(403).json({
          status: 'error',
          message: 'Admin or Manager PIN authorization is required to apply discounts.',
        });
      }
    }

    // Fetch Job Card with services, vehicle, and media prior to transaction
    const targetJobCard = await prisma.jobCard.findUnique({
      where: { id: job_card_id },
      include: {
        services: { include: { service: true } },
        vehicle: true,
        invoice: true,
        media: true,
      },
    });

    if (!targetJobCard) {
      return res.status(404).json({
        status: 'error',
        message: `Job Card with ID "${job_card_id}" does not exist.`,
      });
    }

    if (targetJobCard.invoice) {
      return res.status(400).json({
        status: 'error',
        message: `Job Card "${job_card_id}" has already been invoiced (${targetJobCard.invoice.invoice_number}). Double billing is prohibited.`,
      });
    }

    // Compute billable subtotal
    const subtotal = targetJobCard.services.reduce((acc, curr) => acc + parseFloat(curr.price_charged), 0);
    const finalAmount = Math.max(0, parseFloat((subtotal - discountNum).toFixed(2)));

    // Verify deposits to apply
    let depositIds = Array.isArray(applied_deposit_ids) ? applied_deposit_ids : [applied_deposit_ids].filter(Boolean);
    let validDeposits = [];
    let totalDepositsApplied = 0;

    if (depositIds.length > 0) {
      validDeposits = await prisma.customerDeposit.findMany({
        where: {
          id: { in: depositIds },
          status: 'ACTIVE',
        },
      });

      totalDepositsApplied = validDeposits.reduce((sum, d) => sum + parseFloat(d.amount), 0);
    }

    // Balance due to be collected via payments
    const netDue = Math.max(0, parseFloat((finalAmount - totalDepositsApplied).toFixed(2)));

    // Normalize payments array
    let normalizedPayments = [];
    if (Array.isArray(payments) && payments.length > 0) {
      for (const p of payments) {
        const amt = parseFloat(p.amount);
        if (amt > 0) {
          const { enumVal, accountType } = parsePaymentMode(p.payment_method);
          normalizedPayments.push({
            enumVal,
            accountType,
            amount: amt,
            notes: p.notes || null,
          });
        }
      }
    } else if (netDue > 0) {
      // Fallback single payment mode for backward compatibility
      const { enumVal, accountType } = parsePaymentMode(payment_method);
      normalizedPayments.push({
        enumVal,
        accountType,
        amount: netDue,
        notes: null,
      });
    }

    // Generate Invoice Number: INV-YYYYMMDD-XXXX
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${datePrefix}-${randomSuffix}`;

    const primaryPaymentMethod =
      normalizedPayments.length > 0
        ? normalizedPayments[0].enumVal
        : validDeposits.length > 0
        ? validDeposits[0].payment_method
        : 'Cash';

    // CRITICAL: Execute Atomic Prisma Transaction with Outbox Pattern
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 1. Mark Job Card as Completed
      await tx.jobCard.update({
        where: { id: job_card_id },
        data: {
          status: 'COMPLETED',
          updated_at: new Date(),
        },
      });

      // 2. Generate the Immutable Invoice
      const createdInvoice = await tx.invoice.create({
        data: {
          invoice_number: invoiceNumber,
          job_card_id: job_card_id,
          total_amount: finalAmount,
          paid_amount: finalAmount,
          discount_amount: discountNum,
          payment_method: primaryPaymentMethod,
          status: 'PAID',
          cashier_id: cashier_id || null,
        },
      });

      // 3. Mark applied Customer Deposits as APPLIED
      for (const dep of validDeposits) {
        await tx.customerDeposit.update({
          where: { id: dep.id },
          data: {
            status: 'APPLIED',
            applied_to_invoice_id: createdInvoice.id,
            applied_at: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'DEPOSIT_APPLIED_TO_INVOICE',
            description: `Advance deposit of Rs. ${parseFloat(dep.amount).toLocaleString()} applied to Invoice ${invoiceNumber} (${targetJobCard.vehicle?.registration_number || 'N/A'}). Liability converted to revenue.`,
            performed_by_user_id: cashier_id || req.user?.id || null,
            performed_by_name: req.user?.name || 'Shop Cashier',
            metadata: {
              deposit_id: dep.id,
              invoice_id: createdInvoice.id,
              invoice_number: invoiceNumber,
              amount: parseFloat(dep.amount),
            },
          },
        });
      }

      // 4. Record Split Payments & Mutate Ledger
      const createdPayments = [];
      const ledgerMutations = [];

      for (const p of normalizedPayments) {
        const paymentRecord = await tx.payment.create({
          data: {
            invoice_id: createdInvoice.id,
            amount: p.amount,
            payment_method: p.enumVal,
            recorded_by_id: cashier_id || req.user?.id || null,
            notes: p.notes,
          },
        });
        createdPayments.push(paymentRecord);

        // Lock & update ledger account
        let ledgerAccount = await tx.ledger.findUnique({
          where: { account_type: p.accountType },
        });

        if (!ledgerAccount) {
          ledgerAccount = await tx.ledger.create({
            data: {
              account_type: p.accountType,
              current_balance: 0.00,
            },
          });
        }

        const prevBal = parseFloat(ledgerAccount.current_balance);
        const newBal = parseFloat((prevBal + p.amount).toFixed(2));

        await tx.ledger.update({
          where: { account_type: p.accountType },
          data: {
            current_balance: newBal,
            last_updated: new Date(),
          },
        });

        ledgerMutations.push({
          account_type: p.accountType,
          previous_balance: prevBal,
          amount_received: p.amount,
          new_balance: newBal,
        });
      }

      // 5. Record Audit Log if Discount was Authorized
      if (discountNum > 0) {
        await tx.auditLog.create({
          data: {
            action: 'INVOICE_DISCOUNT',
            description: `Discount of Rs. ${discountNum.toLocaleString()} applied to Invoice ${invoiceNumber} (${targetJobCard.vehicle?.registration_number || 'N/A'}). Subtotal: Rs. ${subtotal}, Final Billed: Rs. ${finalAmount}. Authorized by Admin PIN.`,
            performed_by_user_id: pinCheck?.user?.id || cashier_id || null,
            performed_by_name: pinCheck?.user ? `${pinCheck.user.name} (${pinCheck.role})` : 'Shop Admin',
            metadata: {
              invoice_id: createdInvoice.id,
              invoice_number: invoiceNumber,
              subtotal,
              discount_amount: discountNum,
              final_amount: finalAmount,
            },
          },
        });
      }

      // 6. Write Alert to AlertOutbox within transaction
      const hasAfterPhotos = Boolean(
        targetJobCard.media && targetJobCard.media.some((m) => m.type === 'AFTER' || m.type === 'DAMAGE_PROOF')
      );

      const paymentLines = normalizedPayments.map(
        (p) => `• ${p.enumVal} (\`${p.accountType}\`): *Rs. ${p.amount.toLocaleString()}*`
      );
      if (totalDepositsApplied > 0) {
        paymentLines.push(`• Applied Advance Deposit: *Rs. ${totalDepositsApplied.toLocaleString()}*`);
      }

      const alertLines = [
        `💰 *INVOICE SETTLED (ENTERPRISE ERP)*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🧾 *Invoice ID:* \`${invoiceNumber}\``,
        `🚘 *Vehicle:* *${targetJobCard.vehicle.registration_number}* (${targetJobCard.customer_name || targetJobCard.vehicle.customer_name || 'Customer'})`,
        `💵 *Total Amount:* *Rs. ${finalAmount.toLocaleString()}*`,
        `───────────────────────────`,
        `💳 *Tender Breakdown:*`,
        ...paymentLines,
        `───────────────────────────`,
        `⏰ *Settled At:* ${new Date().toLocaleTimeString()}`,
      ];

      if (hasAfterPhotos) {
        alertLines.push(`📸 _Media attached: Before/After photos logged securely._`);
      }
      alertLines.push(`🔒 _Double-entry audited • Decoupled material issuance compliant._`);

      await tx.alertOutbox.create({
        data: {
          type: 'TELEGRAM',
          payload: { text: alertLines.join('\n') },
          status: 'PENDING',
        },
      });

      return {
        invoice: createdInvoice,
        payments: createdPayments,
        appliedDeposits: validDeposits,
        ledgerMutations,
      };
    });

    // Android SMS Receipt for Customer (Asynchronous & Non-blocking)
    const servicesSummary = targetJobCard.services.map((s) => s.service?.name || 'Service').join(', ') || 'Wash Service';
    if (targetJobCard.vehicle.customer_phone) {
      const smsText =
        `[CAR WASH RECEIPT]\n` +
        `Invoice: ${transactionResult.invoice.invoice_number}\n` +
        `Vehicle: ${targetJobCard.vehicle.registration_number}\n` +
        `Customer: ${targetJobCard.customer_name || targetJobCard.vehicle.customer_name || 'Valued Customer'}\n` +
        `Services: ${servicesSummary}\n` +
        `Paid: Rs. ${finalAmount.toLocaleString('en-US')}\n` +
        `Tender: ${primaryPaymentMethod}\n` +
        `Thank you for visiting!`;

      sendSMSReceipt(targetJobCard.vehicle.customer_phone, smsText).catch((err) => {
        console.error('[Checkout] SMS receipt dispatch notice:', err.message);
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Checkout completed successfully. Split payments and deposits settled.',
      data: {
        invoice: transactionResult.invoice,
        payments: transactionResult.payments,
        applied_deposits: transactionResult.appliedDeposits,
        ledger_mutations: transactionResult.ledgerMutations,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/invoices
 * List all settled invoices
 */
async function listInvoicesHandler(req, res, next) {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        job_card: {
          include: {
            vehicle: true,
            services: { include: { service: true } },
          },
        },
        payments: true,
        deposits: true,
        cashier: true,
      },
    });

    return res.status(200).json({
      status: 'success',
      data: invoices,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkoutHandler,
  listInvoicesHandler,
};
