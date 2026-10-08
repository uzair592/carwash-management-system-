const prisma = require('../prisma');

function parsePaymentMode(input) {
  const norm = String(input || 'CASH').trim().toUpperCase();
  if (norm === 'CASH') return { enumVal: 'Cash', accountType: 'Cash_Drawer' };
  if (norm === 'BANK' || norm === 'MAIN_BANK') return { enumVal: 'Bank', accountType: 'Main_Bank' };
  if (norm === 'CARD') return { enumVal: 'Card', accountType: 'Main_Bank' };
  throw new Error(`Invalid payment method: "${input}". Allowed: "CASH", "BANK", "CARD".`);
}

/**
 * POST /api/partners/:id/transactions
 * Records capital injections, drawings, loans, or dividend payouts.
 * In strict double-entry accounting:
 * - DRAWING: Deducts from Ledger (Cash_Drawer / Main_Bank), recorded against Partner equity, ZERO impact on P&L Expense.
 * - CAPITAL_INVESTMENT: Adds to Ledger (Cash_Drawer / Main_Bank), recorded as Partner equity contribution, ZERO impact on P&L Revenue.
 * - LOAN: Adds or deducts depending on direction.
 * - DIVIDEND_PAYOUT: Deducts from Ledger, settles equity payout.
 */
async function createPartnerTransactionHandler(req, res, next) {
  try {
    const { id: partnerId } = req.params;
    const { type, amount, payment_method = 'CASH', notes, date } = req.body;

    const txAmount = parseFloat(amount);
    if (!txAmount || txAmount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Transaction "amount" must be a positive number.',
      });
    }

    const validTypes = ['CAPITAL_INVESTMENT', 'LOAN', 'DRAWING', 'DIVIDEND_PAYOUT'];
    const normType = String(type || '').trim().toUpperCase();
    if (!validTypes.includes(normType)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid transaction type "${type}". Allowed: ${validTypes.join(', ')}.`,
      });
    }

    const { enumVal, accountType } = parsePaymentMode(payment_method);

    const partner = await prisma.partnerEquity.findUnique({
      where: { id: partnerId },
    });

    if (!partner) {
      return res.status(404).json({
        status: 'error',
        message: `Partner with ID "${partnerId}" not found.`,
      });
    }

    const isDeduction = normType === 'DRAWING' || normType === 'DIVIDEND_PAYOUT';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch ledger account
      let ledger = await tx.ledger.findUnique({
        where: { account_type: accountType },
      });

      if (!ledger) {
        ledger = await tx.ledger.create({
          data: { account_type: accountType, current_balance: 0.00 },
        });
      }

      const curBal = parseFloat(ledger.current_balance);
      if (isDeduction && curBal < txAmount) {
        throw new Error(
          `Insufficient funds in ${accountType} for partner ${normType}. Current: Rs. ${curBal.toLocaleString()}, requested: Rs. ${txAmount.toLocaleString()}`
        );
      }

      const newBal = isDeduction
        ? parseFloat((curBal - txAmount).toFixed(2))
        : parseFloat((curBal + txAmount).toFixed(2));

      await tx.ledger.update({
        where: { account_type: accountType },
        data: { current_balance: newBal, last_updated: new Date() },
      });

      // 2. Record PartnerTransaction
      const partnerTx = await tx.partnerTransaction.create({
        data: {
          partner_id: partnerId,
          type: normType,
          amount: txAmount,
          payment_method: enumVal,
          notes: notes ? notes.trim() : null,
          date: date ? new Date(date) : new Date(),
        },
        include: {
          partner: true,
        },
      });

      // 3. Write Audit Log
      await tx.auditLog.create({
        data: {
          action: `PARTNER_${normType}`,
          description: `Partner "${partner.partner_name}" logged ${normType} of Rs. ${txAmount.toLocaleString()} via ${enumVal} (${accountType}). Balance changed: Rs. ${curBal.toLocaleString()} -> Rs. ${newBal.toLocaleString()}. Not counted in P&L.`,
          performed_by_user_id: req.user?.id || null,
          performed_by_name: req.user?.name || 'Shop Admin',
          metadata: {
            partner_transaction_id: partnerTx.id,
            partner_id: partnerId,
            partner_name: partner.partner_name,
            type: normType,
            amount: txAmount,
            account_type: accountType,
            previous_balance: curBal,
            new_balance: newBal,
          },
        },
      });

      // 4. Queue Telegram Notification
      const alertLines = [
        `💼 *PARTNER CAPITAL / DRAWINGS TRANSACTION*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🤝 *Partner:* *${partner.partner_name}* (${partner.equity_percentage}%)`,
        `📑 *Type:* \`${normType}\``,
        `💰 *Amount:* *Rs. ${txAmount.toLocaleString()}*`,
        `💳 *Account:* \`${accountType}\` (${enumVal})`,
        `📊 *Vault Balance:* Rs. ${newBal.toLocaleString()}`,
        `📝 *Notes:* ${notes || 'Personal partner transaction'}`,
        `⚖️ _Isolated from operational P&L expenses/revenue._`,
        `⏰ *Time:* ${new Date().toLocaleTimeString()}`,
      ];

      await tx.alertOutbox.create({
        data: {
          type: 'TELEGRAM',
          payload: { text: alertLines.join('\n') },
          status: 'PENDING',
        },
      });

      return { partnerTx, curBal, newBal, accountType };
    });

    return res.status(201).json({
      status: 'success',
      message: `Partner ${normType} of Rs. ${txAmount.toLocaleString()} processed successfully.`,
      data: result.partnerTx,
      ledger: {
        account_type: result.accountType,
        previous_balance: result.curBal,
        amount_changed: txAmount,
        new_balance: result.newBal,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/partners/:id/transactions
 */
async function getPartnerTransactionsHandler(req, res, next) {
  try {
    const { id: partnerId } = req.params;

    const transactions = await prisma.partnerTransaction.findMany({
      where: { partner_id: partnerId },
      include: { partner: true },
      orderBy: { date: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      count: transactions.length,
      data: transactions,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/partners/transactions
 * Returns all partner transactions
 */
async function listAllPartnerTransactionsHandler(req, res, next) {
  try {
    const transactions = await prisma.partnerTransaction.findMany({
      include: { partner: true },
      orderBy: { date: 'desc' },
      take: 100,
    });

    return res.status(200).json({
      status: 'success',
      count: transactions.length,
      data: transactions,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPartnerTransactionHandler,
  getPartnerTransactionsHandler,
  listAllPartnerTransactionsHandler,
};
