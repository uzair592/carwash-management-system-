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
 * Executes atomic checkout within a Prisma interactive transaction.
 * 1. Checks job card is not already invoiced
 * 2. Marks JobCard Completed
 * 3. Creates Invoice
 * 4. Mutates Ledger row atomically
 * 5. Deducts linked consumables from Inventory (Yield Engine)
 * 6. Dispatches post-commit Telegram alert, SMS receipt, & Low Stock warnings
 */
async function checkoutHandler(req, res, next) {
  try {
    const { job_card_id, payment_method = 'CASH', discount_amount = 0, cashier_id } = req.body;

    if (!job_card_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Field "job_card_id" is required for checkout.',
      });
    }

    const { enumVal, accountType } = parsePaymentMode(payment_method);
    const discountNum = Math.max(0, parseFloat(discount_amount) || 0);

    // Fetch Job Card with services and vehicle prior to transaction
    const targetJobCard = await prisma.jobCard.findUnique({
      where: { id: job_card_id },
      include: {
        services: { include: { service: true } },
        vehicle: true,
        invoice: true,
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

    // Generate Invoice Number: INV-YYYYMMDD-XXXX
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${datePrefix}-${randomSuffix}`;

    // CRITICAL: Execute Atomic Prisma Transaction
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 1. Mark Job Card as Completed
      await tx.jobCard.update({
        where: { id: job_card_id },
        data: {
          status: 'Completed',
          updated_at: new Date(),
        },
      });

      // 2. Generate the Invoice
      const createdInvoice = await tx.invoice.create({
        data: {
          invoice_number: invoiceNumber,
          job_card_id: job_card_id,
          total_amount: finalAmount,
          discount_amount: discountNum,
          payment_method: enumVal,
          cashier_id: cashier_id || null,
        },
      });

      // 3. Lock or query current ledger balance
      let ledgerAccount = await tx.ledger.findUnique({
        where: { account_type: accountType },
      });

      if (!ledgerAccount) {
        ledgerAccount = await tx.ledger.create({
          data: {
            account_type: accountType,
            current_balance: 0.00,
          },
        });
      }

      const prevBal = parseFloat(ledgerAccount.current_balance);
      const newBal = parseFloat((prevBal + finalAmount).toFixed(2));

      // 4. Update the Ledger row
      await tx.ledger.update({
        where: { account_type: accountType },
        data: {
          current_balance: newBal,
          last_updated: new Date(),
        },
      });

      // 5. Yield Engine: Automatic Consumable Inventory Deduction
      const lowStockAlerts = [];
      const deductedItems = [];

      for (const item of targetJobCard.services) {
        const srv = item.service;
        if (srv && srv.linked_inventory_id && srv.inventory_deduction_amount) {
          const deductAmount = parseFloat(srv.inventory_deduction_amount);
          if (deductAmount > 0) {
            const invItem = await tx.inventory.findUnique({
              where: { id: srv.linked_inventory_id },
            });
            if (invItem) {
              const curStock = parseFloat(invItem.current_stock);
              const newStock = Math.max(0, parseFloat((curStock - deductAmount).toFixed(2)));
              const threshold = parseFloat(invItem.low_stock_threshold || 10);

              const updatedInv = await tx.inventory.update({
                where: { id: srv.linked_inventory_id },
                data: {
                  current_stock: newStock,
                  updated_at: new Date(),
                },
              });

              deductedItems.push({
                inventory_id: updatedInv.id,
                item_name: updatedInv.item_name,
                deducted: deductAmount,
                remaining: newStock,
                unit: updatedInv.unit_type,
              });

              if (newStock <= threshold) {
                lowStockAlerts.push({
                  itemName: updatedInv.item_name,
                  amount: newStock,
                  unit: updatedInv.unit_type,
                  threshold: threshold,
                });
              }
            }
          }
        }
      }

      return {
        invoice: createdInvoice,
        ledger: {
          account_type: accountType,
          previous_balance: prevBal,
          amount_received: finalAmount,
          new_balance: newBal,
        },
        deductedItems,
        lowStockAlerts,
      };
    });

    // POST-COMMIT NOTIFICATION DISPATCH (Asynchronous & Non-blocking)
    const servicesSummary = targetJobCard.services.map((s) => s.service?.name || 'Service').join(', ') || 'Wash Service';

    // 1. Telegram Alert for Sleeping Partners
    notifyPaymentReceived({
      invoice_id: transactionResult.invoice.invoice_number,
      registration_number: targetJobCard.vehicle.registration_number,
      payment_method: enumVal,
      account_type: transactionResult.ledger.account_type,
      previous_balance: transactionResult.ledger.previous_balance,
      amount_received: transactionResult.ledger.amount_received,
      new_balance: transactionResult.ledger.new_balance,
    }).catch((err) => {
      console.error('[Checkout] Telegram alert dispatch notice:', err.message);
    });

    // 2. Android SMS Receipt for Customer
    if (targetJobCard.vehicle.customer_phone) {
      const smsText =
        `[CAR WASH RECEIPT]\n` +
        `Invoice: ${transactionResult.invoice.invoice_number}\n` +
        `Vehicle: ${targetJobCard.vehicle.registration_number}\n` +
        `Services: ${servicesSummary}\n` +
        `Paid: Rs. ${finalAmount.toLocaleString('en-US')}\n` +
        `Payment: ${enumVal}\n` +
        `Thank you for visiting!`;

      sendSMSReceipt(targetJobCard.vehicle.customer_phone, smsText).catch((err) => {
        console.error('[Checkout] SMS receipt dispatch notice:', err.message);
      });
    }

    // 3. Low Stock Telegram Alerts for Absentee Partners
    if (transactionResult.lowStockAlerts && transactionResult.lowStockAlerts.length > 0) {
      for (const alert of transactionResult.lowStockAlerts) {
        notifyLowStock(alert).catch((err) => {
          console.error('[Checkout] Low stock alert dispatch notice:', err.message);
        });
      }
    }

    return res.status(200).json({
      status: 'success',
      message: 'Checkout completed successfully. Ledger updated atomically.',
      data: {
        invoice: transactionResult.invoice,
        ledger: transactionResult.ledger,
        inventory_deductions: transactionResult.deductedItems,
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
