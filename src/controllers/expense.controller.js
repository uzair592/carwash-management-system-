const prisma = require('../prisma');
const { notifyExpenseRecorded } = require('../services/notification.service');

/**
 * Normalizes payment mode for expenses
 */
function parseExpensePaymentMode(input) {
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
  throw new Error(`Invalid payment method: "${input}". Allowed: "CASH", "BANK", "CARD".`);
}

/**
 * POST /api/expenses
 * Records an operational outflow atomically in a Prisma transaction.
 * Updates ledger balance and alerts partners via Telegram.
 */
async function createExpenseHandler(req, res, next) {
  try {
    const { category, description, amount, payment_method = 'CASH', recorded_by_id } = req.body;

    const numericAmount = parseFloat(amount);
    if (!category || isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Fields "category" and a positive "amount" are required.',
      });
    }

    const { enumVal, accountType } = parseExpensePaymentMode(payment_method);
    const amountClean = parseFloat(numericAmount.toFixed(2));

    // CRITICAL: Atomic Prisma Transaction
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 1. Create the Expense record
      const expense = await tx.expense.create({
        data: {
          category,
          description: description || null,
          amount: amountClean,
          payment_method: enumVal,
          recorded_by_id: recorded_by_id || null,
        },
      });

      // 2. Query / Lock current balance
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
      const newBal = parseFloat((prevBal - amountClean).toFixed(2));

      // 3. Update the Ledger row
      await tx.ledger.update({
        where: { account_type: accountType },
        data: {
          current_balance: newBal,
          last_updated: new Date(),
        },
      });

      return {
        expense,
        ledger: {
          account_type: accountType,
          previous_balance: prevBal,
          amount_deducted: amountClean,
          new_balance: newBal,
        },
      };
    });

    // POST-COMMIT NOTIFICATION (Non-blocking)
    notifyExpenseRecorded({
      category: transactionResult.expense.category,
      description: transactionResult.expense.description,
      payment_method: enumVal,
      account_type: transactionResult.ledger.account_type,
      previous_balance: transactionResult.ledger.previous_balance,
      amount_deducted: transactionResult.ledger.amount_deducted,
      new_balance: transactionResult.ledger.new_balance,
    }).catch((err) => {
      console.error('[Expense] Telegram alert notice:', err.message);
    });

    return res.status(201).json({
      status: 'success',
      message: 'Expense recorded and ledger deducted atomically.',
      data: {
        expense: transactionResult.expense,
        ledger: transactionResult.ledger,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/expenses
 * List recent operational expenses
 */
async function listExpensesHandler(req, res, next) {
  try {
    const expenses = await prisma.expense.findMany({
      orderBy: { created_at: 'desc' },
      include: { recorded_by: true },
    });

    return res.status(200).json({
      status: 'success',
      data: expenses,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createExpenseHandler,
  listExpensesHandler,
};
