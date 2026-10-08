const prisma = require('../prisma');
const F = require('../services/finance.service');
async function getCurrentSessionHandler(req, res, next) {
  try {
    const data = await F.transact(async tx => {
      await F.lock(tx, 'financial-ledger');
      const session = await tx.registerSession.findFirst({
        where: {
          status: 'OPEN'
        },
        orderBy: {
          opened_at: 'desc'
        }
      });
      const ledger = await tx.ledger.findUnique({
        where: {
          account_type: 'Cash_Drawer'
        }
      });
      const balance = Number(ledger?.current_balance || 0);
      if (!session) return {
        is_open: false,
        single_cashier_mode: true,
        expected_cash_in_drawer: balance
      };
      return {
        is_open: true,
        session,
        starting_cash: Number(session.starting_cash),
        expected_cash_in_drawer: Number(session.starting_cash) + balance - Number(session.ledger_cash_at_open ?? session.starting_cash)
      };
    });
    res.json({
      status: 'success',
      data
    });
  } catch (e) {
    next(e);
  }
}
async function openSessionHandler(req, res, next) {
  try {
    const count = F.amount(req.body.starting_cash, {
      zero: true
    });
    const result = await F.transact(async tx => {
      await F.lock(tx, 'financial-ledger');
      if (await tx.registerSession.findFirst({
        where: {
          status: 'OPEN'
        }
      })) throw F.error('The shop cash drawer already has an opening count.', 409);
      const ledger = await tx.ledger.upsert({
        where: {
          account_type: 'Cash_Drawer'
        },
        create: {
          account_type: 'Cash_Drawer',
          current_balance: 0
        },
        update: {}
      });
      const session = await tx.registerSession.create({
        data: {
          starting_cash: count,
          ledger_cash_at_open: count,
          opened_by_user_id: req.user.id,
          notes: req.body.notes || null
        }
      });
      const delta = (F.cents(count) - F.cents(ledger.current_balance)) / 100;
      if (delta) await F.movement(tx, {
        method: 'Cash',
        delta,
        kind: 'OPENING_COUNT',
        sourceId: session.id
      });
      await F.audit(tx, req, 'DRAWER_OPENING_COUNT', 'Cash drawer opening count recorded.', {
        session_id: session.id,
        count,
        adjustment: delta
      });
      await F.alert(tx, 'Cash drawer opening count: Rs. ' + count, 'drawer-open:' + session.id);
      return session;
    });
    res.status(201).json({
      status: 'success',
      data: result
    });
  } catch (e) {
    next(e);
  }
}
async function closeSessionHandler(req, res, next) {
  try {
    const count = F.amount(req.body.actual_counted_cash, {
      zero: true
    });
    const data = await F.transact(async tx => {
      await F.lock(tx, 'financial-ledger');
      const session = await tx.registerSession.findFirst({
        where: {
          status: 'OPEN'
        },
        orderBy: {
          opened_at: 'desc'
        }
      });
      if (!session) throw F.error('Record the opening cash count first.', 409);
      const ledger = await tx.ledger.findUnique({
        where: {
          account_type: 'Cash_Drawer'
        }
      });
      const expected = (F.cents(session.starting_cash) + F.cents(ledger?.current_balance || 0) - F.cents(session.ledger_cash_at_open ?? session.starting_cash)) / 100;
      const variance = (F.cents(count) - F.cents(expected)) / 100;
      const closed = await tx.registerSession.update({
        where: {
          id: session.id
        },
        data: {
          status: 'CLOSED',
          closed_at: new Date(),
          expected_closing_cash: expected,
          actual_counted_cash: count,
          variance,
          notes: req.body.notes || session.notes
        }
      });
      await F.audit(tx, req, 'DRAWER_RECONCILIATION', 'Shop drawer counted.', {
        session_id: session.id,
        count,
        expected,
        variance
      });
      await F.alert(tx, 'Cash drawer counted Rs. ' + count + '; expected Rs. ' + expected + '; variance Rs. ' + variance, 'drawer-close:' + session.id);
      return {
        session: closed,
        reconciliation: {
          starting_cash: Number(session.starting_cash),
          expected_closing_cash: expected,
          actual_counted_cash: count,
          variance,
          is_balanced: variance === 0
        }
      };
    });
    res.json({
      status: 'success',
      data
    });
  } catch (e) {
    next(e);
  }
}
async function getHistorySessionsHandler(req, res, next) {
  try {
    res.json({
      status: 'success',
      data: await prisma.registerSession.findMany({
        orderBy: {
          opened_at: 'desc'
        },
        take: 100
      })
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  getCurrentSessionHandler,
  openSessionHandler,
  closeSessionHandler,
  getHistorySessionsHandler
};
