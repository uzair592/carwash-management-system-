const prisma = require('../prisma');

/**
 * GET /api/payroll/generate?month=YYYY-MM
 * Calculates monthly payroll for all active staff:
 * - Base Salary (from User record)
 * - Total Commissions Earned (Sum of commission from completed Job Cards in the requested month)
 * - Total Payout = Base Salary + Commissions Earned
 */
async function generatePayrollHandler(req, res, next) {
  try {
    res.json({
      status: 'success',
      data: await require('../services/payroll.service').generateMonthlyPayroll(req.query.month || new Date().toISOString().slice(0, 7))
    });
  } catch (e) {
    next(e);
  }
}

/**
 * PATCH /api/payroll/users/:id/salary
 * Updates user base salary and commission rate
 */
async function updateStaffSalaryHandler(req, res, next) {
  try {
    const F = require('../services/finance.service');
    const data = {};
    for (const key of ['base_salary', 'commission_rate', 'flat_commission']) if (req.body[key] !== undefined) data[key] = F.amount(req.body[key], {
      zero: true
    });
    if (data.commission_rate > 100) throw F.error('Commission rate cannot exceed 100%.');
    const updated = await F.transact(async tx => {
      const user = await tx.user.findUnique({
        where: {
          id: req.params.id
        }
      });
      if (!user) throw F.error('Staff member not found.', 404);
      const result = await tx.user.update({
        where: {
          id: user.id
        },
        data
      });
      await F.audit(tx, req, 'STAFF_COMPENSATION_UPDATED', 'Staff compensation changed.', {
        user_id: user.id,
        ...data
      });
      return {
        id: result.id,
        name: result.name,
        base_salary: result.base_salary,
        commission_rate: result.commission_rate,
        flat_commission: result.flat_commission
      };
    });
    res.json({
      status: 'success',
      data: updated
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  generatePayrollHandler,
  updateStaffSalaryHandler
};
