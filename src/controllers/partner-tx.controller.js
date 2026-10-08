const prisma = require('../prisma');
function parsePaymentMode(input) {
  const norm = String(input || 'CASH').trim().toUpperCase();
  if (norm === 'CASH') return {
    enumVal: 'Cash',
    accountType: 'Cash_Drawer'
  };
  if (norm === 'BANK' || norm === 'MAIN_BANK') return {
    enumVal: 'Bank',
    accountType: 'Main_Bank'
  };
  if (norm === 'CARD') return {
    enumVal: 'Card',
    accountType: 'Main_Bank'
  };
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
    const F = require('../services/finance.service');
    const value = F.amount(req.body.amount),
      requestKey = F.key(req, 'partner');
    const type = String(req.body.type || '').toUpperCase();
    if (!['CAPITAL_INVESTMENT', 'LOAN', 'DRAWING', 'DIVIDEND_PAYOUT'].includes(type)) throw F.error('Choose a valid partner transaction.');
    const {
      method
    } = F.mode(req.body.payment_method);
    const result = await F.transact(async tx => {
      await F.lock(tx, requestKey);
      const previous = await tx.partnerTransaction.findUnique({
        where: {
          request_key: requestKey
        }
      });
      if (previous) return previous;
      const partner = await tx.partnerEquity.findUnique({
        where: {
          id: req.params.id
        }
      });
      if (!partner?.is_active) throw F.error('Choose an active partner.');
      const item = await tx.partnerTransaction.create({
        data: {
          partner_id: partner.id,
          type,
          amount: value,
          payment_method: method,
          bank_account_id: req.body.bank_account_id || null,
          request_key: requestKey,
          notes: req.body.notes || null,
          date: new Date()
        }
      });
      const delta = ['DRAWING', 'DIVIDEND_PAYOUT'].includes(type) ? -value : value;
      await F.movement(tx, {
        method,
        bankId: item.bank_account_id,
        delta,
        kind: 'PARTNER_' + type,
        sourceId: item.id
      });
      await F.audit(tx, req, 'PARTNER_' + type, 'Partner capital transaction recorded.', {
        partner_id: partner.id,
        amount: value
      });
      await F.alert(tx, 'Partner ' + type + ': Rs. ' + value, requestKey);
      return item;
    });
    res.status(201).json({
      status: 'success',
      data: result
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/partners/:id/transactions
 */
async function getPartnerTransactionsHandler(req, res, next) {
  try {
    const {
      id: partnerId
    } = req.params;
    const transactions = await prisma.partnerTransaction.findMany({
      where: {
        partner_id: partnerId
      },
      include: {
        partner: true
      },
      orderBy: {
        date: 'desc'
      }
    });
    return res.status(200).json({
      status: 'success',
      count: transactions.length,
      data: transactions
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
      include: {
        partner: true
      },
      orderBy: {
        date: 'desc'
      },
      take: 100
    });
    return res.status(200).json({
      status: 'success',
      count: transactions.length,
      data: transactions
    });
  } catch (err) {
    next(err);
  }
}
module.exports = {
  createPartnerTransactionHandler,
  getPartnerTransactionsHandler,
  listAllPartnerTransactionsHandler
};
