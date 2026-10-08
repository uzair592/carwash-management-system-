const prisma = require('../prisma');
const {
  monthBounds,
  dayKey
} = require('../utils/business-time');
const F = require('./finance.service');
async function generateMonthlyPayroll(month, year) {
  const key = String(month).includes('-') ? String(month) : `${year || new Date().getFullYear()}-${String(month).padStart(2, '0')}`;
  const {
    start,
    end
  } = monthBounds(key);
  const staff = await prisma.user.findMany({
    where: {
      is_active: true
    },
    orderBy: {
      name: 'asc'
    }
  });
  const jobs = await prisma.jobCard.findMany({
    where: {
      completed_at: {
        gte: start,
        lte: end
      },
      status: {
        in: ['READY_FOR_BILLING', 'COMPLETED', 'Completed']
      }
    },
    include: {
      services: true,
      assigned_workers: {
        include: {
          user: true
        }
      },
      worker: true,
      invoice: true
    }
  });
  let commissions = 0,
    base = 0;
  const payroll = staff.map(user => {
    let earned = 0,
      revenue = 0,
      count = 0;
    for (const job of jobs) {
      const assignments = job.commission_snapshot || (job.assigned_workers.length ? job.assigned_workers.map(w => ({
        id: w.user.id,
        flat: Number(w.user.flat_commission),
        rate: Number(w.user.commission_rate),
        share: 1 / job.assigned_workers.length
      })) : job.worker ? [{
        id: job.worker.id,
        flat: Number(job.worker.flat_commission),
        rate: Number(job.worker.commission_rate),
        share: 1
      }] : []);
      const assignment = assignments.find(a => a.id === user.id);
      if (!assignment) continue;
      count++;
      const jobRevenue = job.services.reduce((s, i) => s + F.cents(i.price_charged), 0) / 100;
      revenue += jobRevenue * (assignment.share || 1);
      earned += assignment.flat > 0 ? assignment.flat : jobRevenue * (assignment.share || 1) * assignment.rate / 100;
    }
    earned = Math.round(earned * 100) / 100;
    const salary = Number(user.base_salary);
    commissions += earned;
    base += salary;
    return {
      user_id: user.id,
      name: user.name,
      role: user.role,
      base_salary: salary,
      commission_rate: Number(user.commission_rate),
      flat_commission: Number(user.flat_commission),
      commission_mode: Number(user.flat_commission) > 0 ? 'FLAT_PER_CAR' : 'PERCENTAGE',
      commission_model: Number(user.flat_commission) > 0 ? 'Flat per assigned car' : 'Shared job revenue percentage',
      completed_cars_count: count,
      completed_jobs_count: count,
      revenue_generated: revenue,
      total_revenue_generated: revenue,
      commissions_earned: earned,
      total_payout: salary + earned
    };
  });
  return {
    month: key,
    period: {
      from: start.toISOString(),
      to: end.toISOString()
    },
    summary: {
      staff_count: staff.length,
      total_cars_washed: jobs.length,
      total_base_salaries: base,
      total_commissions: commissions,
      total_payroll_expense: base + commissions
    },
    payroll
  };
}
module.exports = {
  generateMonthlyPayroll
};
