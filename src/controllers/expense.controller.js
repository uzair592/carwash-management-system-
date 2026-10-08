const prisma = require('../prisma');
const F = require('../services/finance.service');
async function createExpenseHandler(req, res, next) {
  try {
    const value = F.amount(req.body.amount),
      requestKey = F.key(req, 'expense');
    if (!String(req.body.category || '').trim()) throw F.error('Choose an expense category.');
    const {
      method
    } = F.mode(req.body.payment_method);
    const result = await F.transact(async tx => {
      await F.lock(tx, requestKey);
      const previous = await tx.expense.findUnique({
        where: {
          request_key: requestKey
        }
      });
      if (previous) return previous;
      const item = await tx.expense.create({
        data: {
          amount: value,
          category: String(req.body.category).trim(),
          description: req.body.description || null,
          payment_method: method,
          bank_account_id: req.body.bank_account_id || null,
          recorded_by_id: req.user.id,
          request_key: requestKey
        }
      });
      await F.movement(tx, {
        method,
        bankId: item.bank_account_id,
        delta: -value,
        kind: 'EXPENSE',
        sourceId: item.id
      });
      await F.audit(tx, req, 'EXPENSE_RECORDED', item.description || item.category, {
        expense_id: item.id,
        amount: value
      });
      await F.alert(tx, 'Expense ' + item.category + ': Rs. ' + value, requestKey);
      return item;
    });
    res.status(201).json({
      status: 'success',
      data: {
        expense: result
      }
    });
  } catch (e) {
    next(e);
  }
}
async function listExpensesHandler(req, res, next) {
  try {
    res.json({
      status: 'success',
      data: await prisma.expense.findMany({
        orderBy: {
          created_at: 'desc'
        },
        take: 200,
        include: {
          recorded_by: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  createExpenseHandler,
  listExpensesHandler
};
