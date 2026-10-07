const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { compileEodMetrics, runEodReportNow } = require('../cron/eod.cron');

/**
 * GET /api/dashboard/live
 * Dedicated read-only endpoint for absentee sleeping partners.
 * Aggregates live bay activity, daily cash flow, and vault balances.
 */
router.get('/live', async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Compile EOD summary metrics
    const financialMetrics = await compileEodMetrics();

    // 2. Query Live Bay Occupancy & In-Progress Jobs
    const activeJobs = await prisma.jobCard.findMany({
      where: {
        status: { in: ['Intake', 'In_Progress'] },
      },
      include: {
        vehicle: true,
        worker: true,
        services: { include: { service: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const inProgressVehicles = activeJobs.filter((j) => j.status === 'In_Progress').map((j) => ({
      job_card_id: j.id,
      ticket_number: j.ticket_number,
      plate: j.vehicle?.registration_number,
      make_model: `${j.vehicle?.make || ''} ${j.vehicle?.model || ''}`.trim() || 'Vehicle',
      worker: j.worker?.name || 'Unassigned',
      services: j.services.map((s) => s.service?.name).join(', '),
      started_at: j.created_at,
    }));

    const intakeQueuedVehicles = activeJobs.filter((j) => j.status === 'Intake').map((j) => ({
      job_card_id: j.id,
      ticket_number: j.ticket_number,
      plate: j.vehicle?.registration_number,
      make_model: `${j.vehicle?.make || ''} ${j.vehicle?.model || ''}`.trim() || 'Vehicle',
      services: j.services.map((s) => s.service?.name).join(', '),
      queued_at: j.created_at,
    }));

    // 3. Recent 5 Settled Invoices
    const recentInvoices = await prisma.invoice.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      include: {
        job_card: {
          include: { vehicle: true },
        },
      },
    });

    const sanitizedInvoices = recentInvoices.map((inv) => ({
      invoice_number: inv.invoice_number,
      plate: inv.job_card?.vehicle?.registration_number || 'N/A',
      amount: parseFloat(inv.total_amount),
      payment_method: inv.payment_method,
      time: inv.created_at,
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        as_of: new Date().toISOString(),
        today_summary: {
          cars_washed_today: financialMetrics.carsCount,
          active_in_bay: inProgressVehicles.length,
          queued_in_intake: intakeQueuedVehicles.length,
          gross_revenue: financialMetrics.grossRevenue,
          cash_revenue: financialMetrics.cashRevenue,
          bank_revenue: financialMetrics.bankRevenue,
          total_expenses: financialMetrics.totalExpenses,
          net_profit: financialMetrics.netSurplus,
        },
        vault_balances: {
          cash_drawer: financialMetrics.cashBalance,
          main_bank: financialMetrics.bankBalance,
          combined_total: financialMetrics.totalVaultAssets,
        },
        live_bays: {
          in_progress: inProgressVehicles,
          queued: intakeQueuedVehicles,
        },
        recent_invoices: sanitizedInvoices,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/dashboard/trigger-eod
 * On-demand manual trigger for sending the EOD partner report to Telegram.
 */
router.post('/trigger-eod', async (req, res, next) => {
  try {
    const result = await runEodReportNow();
    return res.status(200).json({
      status: 'success',
      message: 'End-of-Day Financial Dossier compiled and dispatched.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
