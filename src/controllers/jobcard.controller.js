const prisma = require('../prisma');
const F = require('../services/finance.service');
async function updateJobCardStatusHandler(req, res, next) {
  try {
    if (req.body.status) {
      const status = String(req.body.status).toUpperCase();
      if (status === 'COMPLETED') return require('./physical-bays.controller').completeJobCardHandler(req, res, next);
      if (status === 'IN_PROGRESS') return require('./physical-bays.controller').startJobCardHandler(req, res, next);
      throw F.error('Use the workshop workflow to change status.');
    }
    if (req.body.services?.length) throw F.error('Use an approved service price change before invoicing.');
    const result = await F.transact(async tx => {
      await F.lock(tx, 'job:' + req.params.id);
      const job = await tx.jobCard.findUnique({
        where: {
          id: req.params.id
        },
        include: {
          invoice: true
        }
      });
      if (!job) throw F.error('Job not found.', 404);
      if (job.invoice) throw F.error('Closed invoices and jobs are locked.');
      return tx.jobCard.update({
        where: {
          id: job.id
        },
        data: {
          intake_notes: req.body.intake_notes
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
const include = {
  vehicle: true,
  services: {
    include: {
      service: true
    }
  },
  invoice: true,
  media: true
};
async function listJobCardsHandler(req, res, next) {
  try {
    res.json({
      status: 'success',
      data: await prisma.jobCard.findMany({
        where: req.query.status ? {
          status: req.query.status
        } : {},
        include,
        orderBy: {
          created_at: 'desc'
        },
        take: 200
      })
    });
  } catch (e) {
    next(e);
  }
}
async function getJobCardHandler(req, res, next) {
  try {
    const data = await prisma.jobCard.findUnique({
      where: {
        id: req.params.id
      },
      include
    });
    if (!data) throw F.error('Job not found.', 404);
    res.json({
      status: 'success',
      data
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  updateJobCardStatusHandler,
  listJobCardsHandler,
  getJobCardHandler
};
