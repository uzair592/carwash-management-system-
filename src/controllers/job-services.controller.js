const prisma = require('../prisma');
const F = require('../services/finance.service');
async function updateJobServices(req, res, next) {
  try {
    const ids = req.body.service_ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > 50 || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string')) throw F.error('Choose at least one service, without duplicates.');
    const result = await F.transact(async tx => {
      await F.lock(tx, 'checkout:' + req.params.id);
      const job = await tx.jobCard.findUnique({
        where: {
          id: req.params.id
        },
        include: {
          invoice: true,
          services: {
            include: {
              service: true
            }
          },
          vehicle: true
        }
      });
      if (!job) throw F.error('Work ticket not found.', 404);
      if (job.invoice || ['COMPLETED', 'Completed'].includes(job.status)) throw F.error('Billed work tickets are locked. Create a new ticket or credit note.', 409);
      const selected = await tx.service.findMany({
        where: {
          id: {
            in: ids
          }
        }
      });
      const previous = new Set(job.services.map(s => s.service_id));
      if (selected.length !== ids.length || selected.some(s => !s.is_active && !previous.has(s.id))) throw F.error('Choose available services.');
      const added = ids.filter(id => !previous.has(id));
      const removed = job.services.filter(s => !ids.includes(s.service_id));
      if (!added.length && !removed.length) return job;
      if (!Number.isInteger(req.body.expected_version) || req.body.expected_version !== job.services_version) throw F.error('This ticket changed in another window. Refresh before editing services.', 409);
      await tx.jobCardService.deleteMany({
        where: {
          job_card_id: job.id,
          service_id: {
            in: removed.map(s => s.service_id)
          }
        }
      });
      for (const id of added) {
        const service = selected.find(s => s.id === id);
        await tx.jobCardService.create({
          data: {
            job_card_id: job.id,
            service_id: id,
            price_charged: service.price
          }
        });
      }
      await tx.jobCard.update({
        where: {
          id: job.id
        },
        data: {
          services_version: {
            increment: 1
          }
        }
      });
      // A new service on finished, unbilled work must be completed before invoicing.
      if (added.length && job.status === 'READY_FOR_BILLING') await tx.jobCard.update({
        where: {
          id: job.id
        },
        data: {
          status: 'QUEUED',
          completed_at: null,
          started_at: null,
          assigned_location: null,
          commission_snapshot: null
        }
      });
      await F.audit(tx, req, 'JOB_SERVICES_CHANGED', 'Work-ticket services updated.', {
        job_card_id: job.id,
        added,
        removed: removed.map(s => s.service_id),
        reason: String(req.body.reason || 'Customer service change'),
        retained_material_issues: true
      });
      return tx.jobCard.findUnique({
        where: {
          id: job.id
        },
        include: {
          vehicle: true,
          services: {
            include: {
              service: true
            }
          },
          invoice: true,
          media: true
        }
      });
    });
    res.json({
      status: 'success',
      data: result
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  updateJobServices
};
