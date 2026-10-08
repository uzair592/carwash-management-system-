const prisma = require('../prisma');
const F = require('../services/finance.service');
async function createTransferHandler(req, res, next) {
  try {
    const value = F.amount(req.body.amount),
      requestKey = F.key(req, 'transfer');
    let type = req.body.transfer_type;
    const from = req.body.from_bank_account_id,
      to = req.body.to_bank_account_id;
    if (!type) {
      if (from && to) type = 'BANK_TO_BANK';else if (from) type = 'BANK_TO_CASH';else if (to) type = 'CASH_TO_BANK';else if (req.body.from_account === 'Main_Bank' && req.body.to_account === 'Cash_Drawer') type = 'BANK_TO_CASH';else if (req.body.from_account === 'Cash_Drawer' && req.body.to_account === 'Main_Bank') type = 'CASH_TO_BANK';
    }
    if (!['CASH_TO_BANK', 'BANK_TO_CASH', 'BANK_TO_BANK'].includes(type)) throw F.error('Choose a valid transfer type.');
    if (type !== 'CASH_TO_BANK' && !from || type !== 'BANK_TO_CASH' && !to || from && from === to) throw F.error('Select different source and destination accounts.');
    const result = await F.transact(async tx => {
      await F.lock(tx, requestKey);
      const previous = await tx.ledgerTransfer.findUnique({
        where: {
          request_key: requestKey
        }
      });
      if (previous) return previous;
      const item = await tx.ledgerTransfer.create({
        data: {
          transfer_type: type,
          from_account: type === 'CASH_TO_BANK' ? 'Cash_Drawer' : 'Main_Bank',
          to_account: type === 'BANK_TO_CASH' ? 'Cash_Drawer' : 'Main_Bank',
          from_bank_account_id: from || null,
          to_bank_account_id: to || null,
          amount: value,
          transferred_by_id: req.user.id,
          notes: req.body.notes || null,
          request_key: requestKey
        }
      });
      await F.movement(tx, {
        method: type === 'CASH_TO_BANK' ? 'Cash' : 'Bank',
        bankId: from,
        delta: -value,
        kind: 'TRANSFER_OUT',
        sourceId: item.id
      });
      await F.movement(tx, {
        method: type === 'BANK_TO_CASH' ? 'Cash' : 'Bank',
        bankId: to,
        delta: value,
        kind: 'TRANSFER_IN',
        sourceId: item.id
      });
      await F.audit(tx, req, 'LEDGER_TRANSFER', 'Internal bank/cash transfer.', {
        transfer_id: item.id,
        amount: value,
        type
      });
      await F.alert(tx, type + ' Rs. ' + value, requestKey);
      return item;
    });
    res.status(201).json({
      status: 'success',
      data: result,
      message: 'Transfer recorded.'
    });
  } catch (e) {
    next(e);
  }
}
async function listTransfersHandler(req, res, next) {
  try {
    res.json({
      status: 'success',
      data: await prisma.ledgerTransfer.findMany({
        orderBy: {
          created_at: 'desc'
        },
        take: 100,
        include: {
          from_bank_account: true,
          to_bank_account: true
        }
      })
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  createTransferHandler,
  listTransfersHandler
};
