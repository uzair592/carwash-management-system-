const prisma = require('../prisma');
const { notifyLedgerUpdate } = require('./telegram.service');
const { sendSMS, formatCustomerReceipt } = require('./sms.service');

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
 * Updates the designated ledger account inside an ACID transaction,
 * and immediately triggers Telegram & optional customer SMS alerts upon commit.
 *
 * @param {number | string} amount - The payment amount
 * @param {'Cash' | 'Card'} paymentMethod - Mode of payment ('Cash' -> 'Cash_Drawer', 'Card' -> 'Main_Bank')
 * @param {Object} [meta] - Optional metadata (notes, customer_phone, invoice_number, vehicle_plate)
 * @returns {Promise<{ account_type: string, previous_balance: number, amount_changed: number, new_balance: number }>}
 */
async function processPayment(amount, paymentMethod, meta = {}) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Payment amount must be a positive numeric value.');
  }

  const accountType = resolveAccountType(paymentMethod);

  // 1. CRITICAL ARCHITECTURE RULE: Strict interactive transaction preventing race conditions
  const result = await prisma.$transaction(async (tx) => {
    // Query current balance for account_type, initializing if not present
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

    // Update the ledger balance atomically
    await tx.ledger.update({
      where: { account_type: accountType },
      data: {
        current_balance: newBalance,
        last_updated: new Date(),
      },
    });

    // Append-only accounting journal entry
    await tx.auditLog.create({
      data: {
        action: 'LEDGER_ENTRY',
        description: `Ledger ${accountType}: CREDIT Rs. ${amountChanged.toLocaleString()}. Running balance: Rs. ${newBalance.toLocaleString()}.`,
        performed_by_user_id: meta.user_id || null,
        performed_by_name: meta.user_name || 'Cashier Desk',
        metadata: {
          account_type: accountType,
          type: 'PAYMENT',
          amount: amountChanged,
          previous_balance: previousBalance,
          running_balance: newBalance,
          invoice_number: meta.invoice_number || null,
          vehicle_plate: meta.vehicle_plate || null,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return {
      account_type: accountType,
      previous_balance: previousBalance,
      amount_changed: amountChanged,
      new_balance: newBalance,
    };
  });

  // 2. WIRE NOTIFICATIONS: Post-commit event hook
  const alertPayload = {
    account_type: result.account_type,
    previous_balance: result.previous_balance,
    amount_changed: result.amount_changed,
    new_balance: result.new_balance,
    type: 'PAYMENT',
    description: meta.description || `Payment for Invoice ${meta.invoice_number || 'Cashier Desk'}`,
  };

  // Dispatched asynchronously so partner notifications do not block cashier response
  notifyLedgerUpdate(alertPayload).catch((err) => {
    console.error('[LedgerService] Non-blocking Telegram notification failure:', err.message);
  });

  // Optional Customer SMS Receipt dispatch
  if (meta.customer_phone) {
    const smsReceipt = formatCustomerReceipt({
      invoiceNumber: meta.invoice_number,
      registrationNumber: meta.vehicle_plate,
      servicesDescription: meta.services_summary,
      amount: result.amount_changed,
    });
    sendSMS(meta.customer_phone, smsReceipt).catch((err) => {
      console.error('[LedgerService] Customer SMS delivery failed:', err.message);
    });
  }

  return result;
}

/**
 * Records an operational expense outflow atomically.
 * Deducts the expense amount from the designated ledger account inside an ACID transaction,
 * and immediately triggers Telegram partner alerts upon commit.
 *
 * @param {number | string} amount - The expense amount
 * @param {'Cash' | 'Card'} paymentMethod - Mode of payment ('Cash' -> 'Cash_Drawer', 'Card' -> 'Main_Bank')
 * @param {Object} [meta] - Optional metadata (category, description, recorded_by)
 * @returns {Promise<{ account_type: string, previous_balance: number, amount_changed: number, new_balance: number }>}
 */
async function recordExpense(amount, paymentMethod, meta = {}) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Expense amount must be a positive numeric value.');
  }

  const accountType = resolveAccountType(paymentMethod);

  // 1. CRITICAL ARCHITECTURE RULE: Strict interactive transaction preventing race conditions
  const result = await prisma.$transaction(async (tx) => {
    // Query current balance for account_type, initializing if not present
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

    // Update the ledger balance atomically
    await tx.ledger.update({
      where: { account_type: accountType },
      data: {
        current_balance: newBalance,
        last_updated: new Date(),
      },
    });

    // Append-only accounting journal entry
    await tx.auditLog.create({
      data: {
        action: 'LEDGER_ENTRY',
        description: `Ledger ${accountType}: DEBIT Rs. ${amountChanged.toLocaleString()}. Running balance: Rs. ${newBalance.toLocaleString()}.`,
        performed_by_user_id: meta.user_id || null,
        performed_by_name: meta.user_name || 'Operational Expense',
        metadata: {
          account_type: accountType,
          type: 'EXPENSE',
          category: meta.category || 'GENERAL',
          amount: -amountChanged,
          previous_balance: previousBalance,
          running_balance: newBalance,
          description: meta.description || null,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return {
      account_type: accountType,
      previous_balance: previousBalance,
      amount_changed: -amountChanged,
      new_balance: newBalance,
    };
  });

  // 2. WIRE NOTIFICATIONS: Post-commit event hook
  const alertPayload = {
    account_type: result.account_type,
    previous_balance: result.previous_balance,
    amount_changed: result.amount_changed,
    new_balance: result.new_balance,
    type: 'EXPENSE',
    description: `${meta.category ? `[${meta.category}] ` : ''}${meta.description || 'Operational Expense Outflow'}`,
  };

  // Dispatched asynchronously so partner notifications do not block server response
  notifyLedgerUpdate(alertPayload).catch((err) => {
    console.error('[LedgerService] Non-blocking Telegram notification failure:', err.message);
  });

  return result;
}

module.exports = {
  resolveAccountType,
  processPayment,
  recordExpense,
};
