const prisma = require('../prisma');

/**
 * Maps payment method to target ledger account type.
 * @param {'Cash' | 'Card'} paymentMethod
 * @returns {'Cash_Drawer' | 'Main_Bank'}
 */
function resolveAccountType(paymentMethod) {
  const normalized = String(paymentMethod).trim().toUpperCase();
  if (normalized === 'CASH') {
    return 'Cash_Drawer';
  }
  if (normalized === 'CARD') {
    return 'Main_Bank';
  }
  throw new Error(`Unsupported payment method: "${paymentMethod}". Allowed methods: "Cash", "Card".`);
}

/**
 * Processes a customer payment inflow atomically.
 * Updates the designated ledger account inside an ACID transaction.
 *
 * @param {number | string} amount - The payment amount
 * @param {'Cash' | 'Card'} paymentMethod - Mode of payment ('Cash' -> 'Cash_Drawer', 'Card' -> 'Main_Bank')
 * @returns {Promise<{ account_type: string, previous_balance: number, amount_changed: number, new_balance: number }>}
 */
async function processPayment(amount, paymentMethod) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Payment amount must be a positive numeric value.');
  }

  const accountType = resolveAccountType(paymentMethod);

  // CRITICAL ARCHITECTURE RULE: Strict interactive transaction preventing race conditions
  return await prisma.$transaction(async (tx) => {
    // 1. Query current balance for account_type, initializing if not present
    let account = await tx.ledger.findUnique({
      where: { account_type: accountType },
    });

    if (!account) {
      account = await tx.ledger.create({
        data: {
          account_type: accountType,
          current_balance: 0.00,
        },
      });
    }

    const previousBalance = parseFloat(account.current_balance);
    const amountChanged = parseFloat(numericAmount.toFixed(2));
    const newBalance = parseFloat((previousBalance + amountChanged).toFixed(2));

    // 2. Update the ledger balance atomically
    await tx.ledger.update({
      where: { account_type: accountType },
      data: {
        current_balance: newBalance,
        last_updated: new Date(),
      },
    });

    return {
      account_type: accountType,
      previous_balance: previousBalance,
      amount_changed: amountChanged,
      new_balance: newBalance,
    };
  });
}

/**
 * Records an operational expense outflow atomically.
 * Deducts the expense amount from the designated ledger account inside an ACID transaction.
 *
 * @param {number | string} amount - The expense amount
 * @param {'Cash' | 'Card'} paymentMethod - Mode of payment ('Cash' -> 'Cash_Drawer', 'Card' -> 'Main_Bank')
 * @returns {Promise<{ account_type: string, previous_balance: number, amount_changed: number, new_balance: number }>}
 */
async function recordExpense(amount, paymentMethod) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Expense amount must be a positive numeric value.');
  }

  const accountType = resolveAccountType(paymentMethod);

  // CRITICAL ARCHITECTURE RULE: Strict interactive transaction preventing race conditions
  return await prisma.$transaction(async (tx) => {
    // 1. Query current balance for account_type, initializing if not present
    let account = await tx.ledger.findUnique({
      where: { account_type: accountType },
    });

    if (!account) {
      account = await tx.ledger.create({
        data: {
          account_type: accountType,
          current_balance: 0.00,
        },
      });
    }

    const previousBalance = parseFloat(account.current_balance);
    const amountChanged = parseFloat(numericAmount.toFixed(2));
    const newBalance = parseFloat((previousBalance - amountChanged).toFixed(2));

    // 2. Update the ledger balance atomically
    await tx.ledger.update({
      where: { account_type: accountType },
      data: {
        current_balance: newBalance,
        last_updated: new Date(),
      },
    });

    return {
      account_type: accountType,
      previous_balance: previousBalance,
      amount_changed: -amountChanged,
      new_balance: newBalance,
    };
  });
}

module.exports = {
  resolveAccountType,
  processPayment,
  recordExpense,
};
