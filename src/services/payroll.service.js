const prisma = require('../prisma');

/**
 * Calculates monthly payroll for all active staff:
 * 1. Base Salary
 * 2. Total Completed Job Cards for the month
 * 3. Commissions:
 *    - Flat rate per car for Wash Teams: (Total Cars Washed * flat_commission)
 *    - Percentage rate for Detailing Team: (Detailing Revenue * commission_rate) / 100
 * 4. Final Payout = Base Salary + Commissions
 *
 * @param {number|string} month - Month (1-12 or 'YYYY-MM')
 * @param {number} [year] - Year (e.g. 2026)
 * @returns {Promise<Object>}
 */
async function generateMonthlyPayroll(monthParam, yearParam) {
  let year, monthIndex;

  if (typeof monthParam === 'string' && monthParam.includes('-')) {
    const [yStr, mStr] = monthParam.split('-');
    year = parseInt(yStr, 10);
    monthIndex = parseInt(mStr, 10) - 1;
  } else {
    monthIndex = parseInt(monthParam, 10) - 1;
    year = parseInt(yearParam, 10) || new Date().getFullYear();
  }

  if (isNaN(year) || isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    const now = new Date();
    year = now.getFullYear();
    monthIndex = now.getMonth();
  }

  const startOfMonth = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

  // 1. Fetch all active staff
  const staff = await prisma.user.findMany({
    where: { is_active: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });

  // 2. Fetch completed job cards within the month
  const completedJobs = await prisma.jobCard.findMany({
    where: {
      status: { in: ['COMPLETED', 'Completed', 'READY_FOR_BILLING'] },
      OR: [
        { completed_at: { gte: startOfMonth, lte: endOfMonth } },
        { updated_at: { gte: startOfMonth, lte: endOfMonth } },
      ],
    },
    include: {
      services: { include: { service: true } },
      invoice: true,
    },
  });

  let totalBaseSalaries = 0;
  let totalCommissionsDistributed = 0;
  let totalPayrollExpense = 0;

  const staffPayroll = staff.map((user) => {
    const baseSalary = parseFloat(user.base_salary || 0);
    const commissionRate = parseFloat(user.commission_rate || 0);
    const flatCommission = parseFloat(user.flat_commission || 0);

    // Map jobs to this worker:
    // Match directly by worker_id, or by team assignment name
    const userJobs = completedJobs.filter((job) => {
      if (job.worker_id === user.id) return true;
      if (user.name.toLowerCase().includes('bay 1') && job.assigned_location === 'JACK_1') return true;
      if (user.name.toLowerCase().includes('bay 2') && job.assigned_location === 'JACK_2') return true;
      if (user.name.toLowerCase().includes('detailer') && job.assigned_location === 'DETAILING_CENTER') return true;
      return false;
    });

    let revenueGenerated = 0;
    for (const job of userJobs) {
      const jobRev = job.services.reduce((acc, s) => acc + parseFloat(s.price_charged || s.service?.price || 0), 0);
      revenueGenerated += jobRev;
    }

    let commissionsEarned = 0;
    let commissionModel = 'None';

    if (flatCommission > 0) {
      // Flat rate per car (e.g. Wash Teams: Rs. 150 per car)
      commissionsEarned = userJobs.length * flatCommission;
      commissionModel = `Rs. ${flatCommission.toLocaleString()} / car`;
    } else if (commissionRate > 0) {
      // Percentage of detailing revenue
      commissionsEarned = (revenueGenerated * commissionRate) / 100;
      commissionModel = `${commissionRate}% of revenue`;
    }

    commissionsEarned = parseFloat(commissionsEarned.toFixed(2));
    const totalPayout = parseFloat((baseSalary + commissionsEarned).toFixed(2));

    totalBaseSalaries += baseSalary;
    totalCommissionsDistributed += commissionsEarned;
    totalPayrollExpense += totalPayout;

    return {
      user_id: user.id,
      name: user.name,
      role: user.role,
      base_salary: baseSalary,
      commission_model: commissionModel,
      commission_mode: flatCommission > 0 ? 'FLAT_PER_CAR' : 'PERCENTAGE',
      commission_rate: commissionRate,
      flat_commission: flatCommission,
      completed_cars_count: userJobs.length,
      completed_jobs_count: userJobs.length,
      revenue_generated: parseFloat(revenueGenerated.toFixed(2)),
      total_revenue_generated: parseFloat(revenueGenerated.toFixed(2)),
      commissions_earned: commissionsEarned,
      total_payout: totalPayout,
    };
  });

  return {
    month: monthKey,
    period: {
      from: startOfMonth.toISOString(),
      to: endOfMonth.toISOString(),
    },
    summary: {
      staff_count: staffPayroll.length,
      total_cars_washed: completedJobs.length,
      total_base_salaries: parseFloat(totalBaseSalaries.toFixed(2)),
      total_commissions: parseFloat(totalCommissionsDistributed.toFixed(2)),
      total_payroll_expense: parseFloat(totalPayrollExpense.toFixed(2)),
    },
    payroll: staffPayroll,
  };
}

module.exports = {
  generateMonthlyPayroll,
};
