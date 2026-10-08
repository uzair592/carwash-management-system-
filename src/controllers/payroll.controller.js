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
    const {
      id
    } = req.params;
    const {
      base_salary,
      commission_rate,
      flat_commission
    } = req.body;
    const data = {};
    if (base_salary !== undefined) data.base_salary = parseFloat(base_salary) || 0;
    if (commission_rate !== undefined) data.commission_rate = parseFloat(commission_rate) || 0;
    if (flat_commission !== undefined) data.flat_commission = parseFloat(flat_commission) || 0;
    const updated = await prisma.user.update({
      where: {
        id
      },
      data
    });
    return res.status(200).json({
      status: 'success',
      message: `Staff member ${updated.name} compensation updated successfully.`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}
module.exports = {
  generatePayrollHandler,
  updateStaffSalaryHandler
};
