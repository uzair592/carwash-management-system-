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
  return { enumVal: 'Cash', accountType: 'Cash_Drawer' };
}

/**
 * POST /api/invoices/checkout
 * Editable payment collection with support for cash tendered/change, partial payments,
 * split cash + multiple bank accounts, and immutable accounting invariants.
 */
async function checkoutHandler(req, res, next) {
  try {
    const {
      job_card_id,
      payment_method = 'CASH',
      payments = [],
      collected_amount,
      cash_tendered,
      bank_account_id,
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
    if (discountNum > 0) {
      const { verifyAdminOrManagerPin } = require('../middleware/auth.middleware');
      const pinCheck = await verifyAdminOrManagerPin(admin_pin);
      if (!pinCheck.isValid) {
        return res.status(403).json({
          status: 'error',
          message: 'Admin or Manager PIN authorization is required to apply discounts.',
        });
      }
    }

    // Fetch Job Card with services, vehicle, and existing invoice
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

    // Verify and calculate deposits to apply
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

    // Net balance due before payments
    const netDue = Math.max(0, parseFloat((finalAmount - totalDepositsApplied).toFixed(2)));

    // Normalize and strictly validate incoming payments
    let normalizedPayments = [];

    if (Array.isArray(payments) && payments.length > 0) {
      for (const p of payments) {
        const amt = parseFloat(p.amount);
        if (amt > 0) {
          const { enumVal, accountType } = parsePaymentMode(p.payment_method);
          let bankAccId = p.bank_account_id || (enumVal === 'Bank' || enumVal === 'Card' ? bank_account_id : null) || null;

          if ((enumVal === 'Bank' || enumVal === 'Card') && !bankAccId) {
            const defaultBank = await prisma.bankAccount.findFirst({ where: { is_active: true } });
            if (defaultBank) {
              bankAccId = defaultBank.id;
            } else {
              return res.status(400).json({
                status: 'error',
                message: 'Field "bank_account_id" is required for Bank payments to record individual bank account balances.',
              });
            }
          }

          const pTender = p.tender_amount !== undefined && p.tender_amount !== null
            ? parseFloat(p.tender_amount)
            : (enumVal === 'Cash' && cash_tendered ? parseFloat(cash_tendered) : amt);

          if (enumVal === 'Cash' && pTender < amt) {
            return res.status(400).json({
              status: 'error',
              message: `Cash tendered (Rs. ${pTender}) cannot be less than the payment amount (Rs. ${amt}).`,
            });
          }

          normalizedPayments.push({
            enumVal,
            accountType,
            amount: amt,
            bank_account_id: bankAccId,
            tender_amount: pTender,
            change_amount: enumVal === 'Cash' && pTender > amt ? parseFloat((pTender - amt).toFixed(2)) : 0,
            notes: p.notes || null,
          });
        }
      }
    } else {
      // Single payment entry
      const { enumVal, accountType } = parsePaymentMode(payment_method);
      const tenderProvided = cash_tendered !== undefined && cash_tendered !== null && String(cash_tendered).trim() !== '';
      const tenderNum = tenderProvided ? parseFloat(cash_tendered) : null;
      const collProvided = collected_amount !== undefined && collected_amount !== null && String(collected_amount).trim() !== '';
      const collNum = collProvided ? parseFloat(collected_amount) : null;

      let paymentAmt = 0;
      let finalTender = 0;
      let finalChange = 0;

      if (enumVal === 'Cash') {
        if (collProvided && collNum <= 0 && netDue > 0) {
          return res.status(400).json({ status: 'error', message: 'Collected payment amount must be greater than zero.' });
        }
        if (tenderProvided && tenderNum < 0) {
          return res.status(400).json({ status: 'error', message: 'Cash tendered cannot be negative.' });
        }

        if (collProvided) {
          if (tenderProvided && tenderNum < collNum) {
            return res.status(400).json({
              status: 'error',
              message: `Cash tendered (Rs. ${tenderNum}) cannot be less than collected payment amount (Rs. ${collNum}).`,
            });
          }
          if (collNum > netDue) {
            // Cap payment at netDue, excess is change returned
            paymentAmt = netDue;
            finalTender = tenderProvided ? Math.max(tenderNum, collNum) : collNum;
            finalChange = parseFloat((finalTender - netDue).toFixed(2));
          } else {
            paymentAmt = collNum;
            finalTender = tenderProvided ? tenderNum : collNum;
            finalChange = parseFloat((finalTender - collNum).toFixed(2));
          }
        } else if (tenderProvided) {
          if (tenderNum < netDue) {
            return res.status(400).json({
              status: 'error',
              message: `Cash tendered (Rs. ${tenderNum}) is insufficient to settle the bill of Rs. ${netDue}. To record a partial payment, specify collected_amount = ${tenderNum}.`,
            });
          }
          paymentAmt = netDue;
          finalTender = tenderNum;
          finalChange = parseFloat((tenderNum - netDue).toFixed(2));
        } else {
          paymentAmt = netDue;
          finalTender = netDue;
          finalChange = 0;
        }
      } else {
        // BANK / CARD
        let targetBankId = bank_account_id;
        if (!targetBankId) {
          const defaultBank = await prisma.bankAccount.findFirst({ where: { is_active: true } });
          if (defaultBank) {
            targetBankId = defaultBank.id;
          } else {
            return res.status(400).json({
              status: 'error',
              message: 'Field "bank_account_id" is required for Bank payments to record individual bank account balances.',
            });
          }
        }
        const targetAmt = collProvided ? collNum : netDue;
        if (targetAmt > netDue) {
          return res.status(400).json({
            status: 'error',
            message: `Bank payment amount (Rs. ${targetAmt}) exceeds net balance due (Rs. ${netDue}). Overpayment is not allowed for bank transfers.`,
          });
        }
        paymentAmt = targetAmt;
        finalTender = targetAmt;
        finalChange = 0;
        bank_account_id = targetBankId;
      }

      if (paymentAmt > 0) {
        normalizedPayments.push({
          enumVal,
          accountType,
          amount: paymentAmt,
          bank_account_id: (enumVal === 'Bank' || enumVal === 'Card') ? bank_account_id : null,
          tender_amount: finalTender,
          change_amount: finalChange,
          notes: null,
        });
      }
    }

    // Verify all bank accounts exist in DB
    for (const p of normalizedPayments) {
      if (p.bank_account_id) {
        const bankAcc = await prisma.bankAccount.findUnique({ where: { id: p.bank_account_id } });
        if (bankAcc && !bankAcc.is_active) {
          return res.status(400).json({
            status: 'error',
            message: `Bank account with ID "${p.bank_account_id}" is deactivated.`,
          });
        }
      }
    }

    // Cap total payments entered to netDue (excess cash converted to change)
    let totalPaymentsEntered = normalizedPayments.reduce((sum, p) => sum + p.amount, 0);
    if (totalPaymentsEntered > netDue) {
      const cashPay = normalizedPayments.find((p) => p.enumVal === 'Cash');
      if (cashPay) {
        const excess = parseFloat((totalPaymentsEntered - netDue).toFixed(2));
        cashPay.amount = Math.max(0, parseFloat((cashPay.amount - excess).toFixed(2)));
        cashPay.change_amount = parseFloat(((cashPay.change_amount || 0) + excess).toFixed(2));
        totalPaymentsEntered = netDue;
      } else {
        return res.status(400).json({
          status: 'error',
          message: `Total payment amount (Rs. ${totalPaymentsEntered}) exceeds net balance due (Rs. ${netDue}).`,
        });
      }
    }

    // Determine total cash tendered and total change returned
    let totalCashTendered = 0;
    let totalChangeReturned = 0;

    normalizedPayments.forEach((p) => {
      if (p.enumVal === 'Cash') {
        const tender = p.tender_amount || p.amount;
        totalCashTendered += tender;
        totalChangeReturned += (p.change_amount || 0);
      }
    });

    if (cash_tendered && parseFloat(cash_tendered) > totalCashTendered) {
      totalCashTendered = parseFloat(cash_tendered);
      const totalCashApplied = normalizedPayments.filter((p) => p.enumVal === 'Cash').reduce((s, p) => s + p.amount, 0);
      totalChangeReturned = Math.max(0, parseFloat((totalCashTendered - totalCashApplied).toFixed(2)));
    }

    // Calculate Paid vs Outstanding Balance
    const totalCollectedSoFar = parseFloat((totalDepositsApplied + totalPaymentsEntered).toFixed(2));
    const isFullySettled = totalCollectedSoFar >= finalAmount;
    const balanceDue = isFullySettled ? 0 : parseFloat((finalAmount - totalCollectedSoFar).toFixed(2));
    const invoiceStatus = isFullySettled ? 'PAID' : (totalCollectedSoFar > 0 ? 'PARTIAL' : 'UNPAID');

    // Generate Sequential Invoice Number: INV-YYYYMMDD-XXXX
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${datePrefix}-${randomSuffix}`;

    const primaryPaymentMethod =
      normalizedPayments.length > 0
        ? normalizedPayments[0].enumVal
        : validDeposits.length > 0
        ? validDeposits[0].payment_method
        : 'Cash';

    // Execute Atomic Prisma Transaction
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 1. Mark Job Card as Completed
      await tx.jobCard.update({
        where: { id: job_card_id },
        data: {
          status: 'COMPLETED',
          updated_at: new Date(),
        },
      });

      // Increment vehicle completed visits strictly once upon completed job
      if (targetJobCard.vehicle_id) {
        await tx.vehicle.update({
          where: { id: targetJobCard.vehicle_id },
          data: {
            visits: { increment: 1 },
            updated_at: new Date(),
          },
        });
      }

      // 2. Generate Invoice with balance tracking
      const createdInvoice = await tx.invoice.create({
        data: {
          invoice_number: invoiceNumber,
          job_card_id: job_card_id,
          total_amount: finalAmount,
          paid_amount: totalCollectedSoFar,
          cash_tendered: totalCashTendered > 0 ? totalCashTendered : null,
          change_returned: totalChangeReturned > 0 ? totalChangeReturned : null,
          balance_due: balanceDue,
          discount_amount: discountNum,
          payment_method: primaryPaymentMethod,
          status: invoiceStatus,
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
            description: `Advance deposit of Rs. ${parseFloat(dep.amount).toLocaleString()} applied to Invoice ${invoiceNumber} (${targetJobCard.vehicle?.registration_number || 'N/A'}).`,
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

      // 4. Record Payments & Update Vault / Bank Balances with Append-Only Journal
      const createdPayments = [];

      for (const p of normalizedPayments) {
        // Create payment record
        const paymentRecord = await tx.payment.create({
          data: {
            invoice_id: createdInvoice.id,
            amount: p.amount,
            payment_method: p.enumVal,
            bank_account_id: p.bank_account_id || null,
            tender_amount: p.tender_amount || null,
            change_amount: p.change_amount || null,
            recorded_by_id: cashier_id || req.user?.id || null,
            notes: p.notes,
          },
        });
        createdPayments.push(paymentRecord);

        // Update overall Ledger vault
        await tx.ledger.upsert({
          where: { account_type: p.accountType },
          create: { account_type: p.accountType, current_balance: p.amount },
          update: { current_balance: { increment: p.amount }, last_updated: new Date() },
        });

        // If specific BankAccount was selected, increment that bank account's balance
        if (p.bank_account_id) {
          await tx.bankAccount.update({
            where: { id: p.bank_account_id },
            data: {
              current_balance: { increment: p.amount },
            },
          });
        }

        // Append-only journal audit log for each financial movement
        await tx.auditLog.create({
          data: {
            action: 'LEDGER_ENTRY',
            description: `Ledger ${p.accountType} credit of Rs. ${p.amount.toLocaleString()} for Invoice ${invoiceNumber}.`,
            performed_by_user_id: cashier_id || req.user?.id || null,
            performed_by_name: req.user?.name || 'Shop Cashier',
            metadata: {
              account_type: p.accountType,
              payment_method: p.enumVal,
              amount: p.amount,
              bank_account_id: p.bank_account_id,
              invoice_id: createdInvoice.id,
              invoice_number: invoiceNumber,
              tender_amount: p.tender_amount,
              change_amount: p.change_amount,
              timestamp: new Date().toISOString(),
            },
          },
        });
      }

      // 5. Audit Log Entry
      await tx.auditLog.create({
        data: {
          action: 'INVOICE_CHECKOUT',
          description: `Invoice ${invoiceNumber} settled. Total: Rs. ${finalAmount.toLocaleString()}, Paid: Rs. ${totalCollectedSoFar.toLocaleString()}, Status: ${invoiceStatus}${balanceDue > 0 ? `, Outstanding Balance: Rs. ${balanceDue.toLocaleString()}` : ''}.`,
          performed_by_user_id: cashier_id || req.user?.id || null,
          performed_by_name: req.user?.name || 'Shop Cashier',
          metadata: {
            invoice_id: createdInvoice.id,
            total_amount: finalAmount,
            paid_amount: totalCollectedSoFar,
            balance_due: balanceDue,
            status: invoiceStatus,
            cash_tendered: totalCashTendered,
            change_returned: totalChangeReturned,
          },
        },
      });

      // 6. Enqueue Telegram Alert
      const alertLines = [
        `🧾 *INVOICE SETTLED (${invoiceStatus})*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🔢 *Invoice:* \`${invoiceNumber}\``,
        `🚘 *Vehicle:* *${targetJobCard.vehicle?.registration_number || 'N/A'}*`,
        `💰 *Invoice Total:* Rs. ${finalAmount.toLocaleString()}`,
        totalDepositsApplied > 0 ? `🎟 *Advance Applied:* Rs. ${totalDepositsApplied.toLocaleString()}` : '',
        `💵 *Payment Collected:* Rs. ${totalPaymentsEntered.toLocaleString()}`,
        totalCashTendered > 0 ? `💵 *Cash Tendered:* Rs. ${totalCashTendered.toLocaleString()}` : '',
        totalChangeReturned > 0 ? `🪙 *Change Returned:* Rs. ${totalChangeReturned.toLocaleString()}` : '',
        balanceDue > 0 ? `⚠️ *Outstanding Balance Due:* Rs. ${balanceDue.toLocaleString()}` : '',
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].filter(Boolean).join('\n');

      await tx.alertOutbox.create({
        data: {
          type: 'TELEGRAM',
          payload: { text: alertLines },
          status: 'PENDING',
        },
      });

      return {
        invoice: createdInvoice,
        payments: createdPayments,
      };
    });

    // Send customer SMS if customer phone is provided
    if (targetJobCard.vehicle?.customer_phone) {
      const receiptSMS = [
        `DF PRO Car Wash & Detailing:`,
        `Invoice: ${invoiceNumber}`,
        `Vehicle: ${targetJobCard.vehicle.registration_number}`,
        `Total: Rs. ${finalAmount}`,
        `Paid: Rs. ${totalCollectedSoFar}`,
        balanceDue > 0 ? `Balance Due: Rs. ${balanceDue}` : 'Paid in Full',
        `Thank you for your visit!`,
      ].join('\n');

      sendSMSReceipt(targetJobCard.vehicle.customer_phone, receiptSMS).catch((err) =>
        console.warn('[Checkout] SMS notice:', err.message)
      );
    }

    const completeInvoice = await prisma.invoice.findUnique({
      where: { id: transactionResult.invoice.id },
      include: {
        payments: { include: { bank_account: true } },
        job_card: {
          include: {
            vehicle: true,
            services: { include: { service: true } },
          },
        },
        deposits: true,
      },
    });

    return res.status(200).json({
      status: 'success',
      message: `Checkout successful. Invoice ${invoiceNumber} created with status ${invoiceStatus}.`,
      data: {
        invoice: completeInvoice,
        payments: completeInvoice.payments,
        applied_deposits: completeInvoice.deposits,
        subtotal,
        discount_amount: discountNum,
        final_total: finalAmount,
        deposits_applied: totalDepositsApplied,
        net_due: netDue,
        payments_collected: totalPaymentsEntered,
        cash_tendered: totalCashTendered,
        change_returned: totalChangeReturned,
        balance_due: balanceDue,
        status: invoiceStatus,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/invoices/:id/reverse-payment
 * Authorised payment reversal / adjustment (Requirement 4: preserve immutable accounting)
 */
async function reversePaymentHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { payment_id, admin_pin, reason } = req.body;

    if (!admin_pin || !reason) {
      return res.status(400).json({
        status: 'error',
        message: 'Admin PIN and reason are strictly required for payment reversal.',
      });
    }

    const { verifyAdminOrManagerPin } = require('../middleware/auth.middleware');
    const pinCheck = await verifyAdminOrManagerPin(admin_pin);
    if (!pinCheck.isValid) {
      return res.status(403).json({
        status: 'error',
        message: 'Admin or Manager PIN authorization is required for payment reversal.',
      });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        payments: true,
        job_card: { include: { vehicle: true } },
      },
    });

    if (!invoice) {
      return res.status(404).json({ status: 'error', message: 'Invoice not found.' });
    }

    const payment = invoice.payments.find((p) => p.id === payment_id) || invoice.payments[0];
    if (!payment) {
      return res.status(404).json({ status: 'error', message: 'Payment record not found.' });
    }

    const reversedAmount = parseFloat(payment.amount);
    const accountType = payment.payment_method === 'Cash' ? 'Cash_Drawer' : 'Main_Bank';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Decrement Ledger vault
      await tx.ledger.update({
        where: { account_type: accountType },
        data: {
          current_balance: { decrement: reversedAmount },
          last_updated: new Date(),
        },
      });

      // 2. If bank account was tied, decrement its balance
      if (payment.bank_account_id) {
        await tx.bankAccount.update({
          where: { id: payment.bank_account_id },
          data: {
            current_balance: { decrement: reversedAmount },
          },
        });
      }

      // 3. Update Invoice paid_amount and balance_due
      const newPaid = Math.max(0, parseFloat((parseFloat(invoice.paid_amount) - reversedAmount).toFixed(2)));
      const newBalanceDue = parseFloat((parseFloat(invoice.total_amount) - newPaid).toFixed(2));
      const newStatus = newPaid === 0 ? 'UNPAID' : 'PARTIAL';

      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          paid_amount: newPaid,
          balance_due: newBalanceDue,
          status: newStatus,
        },
      });

      // 4. Record negative adjustment payment record for immutable history
      await tx.payment.create({
        data: {
          invoice_id: invoice.id,
          amount: -reversedAmount,
          payment_method: payment.payment_method,
          bank_account_id: payment.bank_account_id,
          recorded_by_id: pinCheck.user.id,
          notes: `REVERSAL: ${reason}`,
        },
      });

      // 5. Immutable Audit Log
      await tx.auditLog.create({
        data: {
          action: 'PAYMENT_REVERSAL',
          description: `Payment of Rs. ${reversedAmount.toLocaleString()} reversed on Invoice ${invoice.invoice_number} (${invoice.job_card?.vehicle?.registration_number || 'N/A'}). Reason: "${reason}". Authorized by ${pinCheck.user.name}.`,
          performed_by_user_id: pinCheck.user.id,
          performed_by_name: pinCheck.user.name,
          metadata: {
            invoice_id: id,
            reversed_payment_id: payment.id,
            amount: reversedAmount,
            reason,
            new_status: newStatus,
          },
        },
      });

      return updatedInvoice;
    });

    return res.status(200).json({
      status: 'success',
      message: `Payment of Rs. ${reversedAmount.toLocaleString()} successfully reversed.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/invoices
 * Lists historical invoices with balance and payment details
 */
async function listInvoicesHandler(req, res, next) {
  try {
    const { status, limit = 50 } = req.query;
    const where = {};
    if (status) {
      where.status = status;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: parseInt(limit, 10),
      include: {
        payments: { include: { bank_account: true } },
        job_card: {
          include: {
            vehicle: true,
            services: { include: { service: true } },
          },
        },
        deposits: true,
      },
    });

    return res.status(200).json({
      status: 'success',
      count: invoices.length,
      data: invoices,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkoutHandler,
  reversePaymentHandler,
  listInvoicesHandler,
};
