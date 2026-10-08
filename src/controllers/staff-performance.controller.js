const prisma = require('../prisma');
const {
  rangeDates
} = require('../utils/business-time');
function assignmentRows(job) {
  return job.commission_snapshot || (job.assigned_workers?.length ? job.assigned_workers.map(w => ({
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
}
function jobEarnings(job, assignment) {
  const revenue = job.services.reduce((s, line) => s + Number(line.price_charged), 0);
  return assignment.flat > 0 ? Number(assignment.flat) : revenue * Number(assignment.share ?? 1) * Number(assignment.rate || 0) / 100;
}
async function getStaffPerformance(req, res, next) {
  try {
    const {
      start,
      end
    } = rangeDates({
      range: req.query.range || 'today'
    });
    const [workers, jobs] = await Promise.all([prisma.user.findMany({
      where: {
        role: 'Worker',
        is_active: true
      },
      select: {
        id: true,
        name: true,
        role: true,
        commission_rate: true,
        flat_commission: true
      }
    }), prisma.jobCard.findMany({
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
            user: {
              select: {
                id: true,
                commission_rate: true,
                flat_commission: true
              }
            }
          }
        },
        worker: {
          select: {
            id: true,
            commission_rate: true,
            flat_commission: true
          }
        }
      }
    })]);
    const data = workers.map(w => {
      let cars = 0,
        revenue = 0,
        earned = 0;
      for (const job of jobs) {
        const assignment = assignmentRows(job).find(a => a.id === w.id);
        if (!assignment) continue;
        cars++;
        revenue += job.services.reduce((sum, s) => sum + Number(s.price_charged), 0) * Number(assignment.share ?? 1);
        earned += jobEarnings(job, assignment);
      }
      return {
        id: w.id,
        name: w.name,
        role: w.role,
        commission_rate: Number(w.commission_rate),
        flat_commission: Number(w.flat_commission),
        cars_completed: cars,
        total_revenue_generated: Math.round(revenue * 100) / 100,
        estimated_commission: Math.round(earned * 100) / 100
      };
    }).sort((a, b) => b.cars_completed - a.cars_completed || a.name.localeCompare(b.name));
    res.json({
      status: 'success',
      data,
      summary: {
        completed_jobs: jobs.length,
        assigned_workers: workers.length,
        commissions: data.reduce((s, w) => s + w.estimated_commission, 0)
      },
      as_of: new Date().toISOString()
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  getStaffPerformance,
  assignmentRows,
  jobEarnings
};
