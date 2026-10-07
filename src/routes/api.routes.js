const express = require('express');
const router = express.Router();
const prisma = require('../prisma');

// Controllers
const { getSettingsHandler, updateSettingsHandler } = require('../controllers/settings.controller');
const { vehicleIntakeHandler, getVehicleHandler } = require('../controllers/vehicle.controller');
const { updateJobCardStatusHandler, listJobCardsHandler, getJobCardHandler } = require('../controllers/jobcard.controller');
const { checkoutHandler, listInvoicesHandler } = require('../controllers/invoice.controller');
const { createExpenseHandler, listExpensesHandler } = require('../controllers/expense.controller');
const { processPayment, recordExpense } = require('../services/ledger.service');

// ---------------------------------------------------------------------------
// 1. Health & Service Diagnostics
// ---------------------------------------------------------------------------
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Car Wash Management System Core API',
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// 2. Dynamic Feature Flags
// ---------------------------------------------------------------------------
router.get('/settings', getSettingsHandler);
router.patch('/settings', updateSettingsHandler);

// ---------------------------------------------------------------------------
// 3. Vehicles & Intake ("No-Ticket, No-Work" Entry Point)
// ---------------------------------------------------------------------------
router.post('/vehicles/intake', vehicleIntakeHandler);
router.get('/vehicles/:registration', getVehicleHandler);

// ---------------------------------------------------------------------------
// 4. Job Card State Machine
// ---------------------------------------------------------------------------
router.get('/job-cards', listJobCardsHandler);
router.get('/job-cards/:id', getJobCardHandler);
router.patch('/job-cards/:id/status', updateJobCardStatusHandler);

// ---------------------------------------------------------------------------
// 5. Checkout & Invoicing
// ---------------------------------------------------------------------------
router.post('/invoices/checkout', checkoutHandler);
router.get('/invoices', listInvoicesHandler);

// ---------------------------------------------------------------------------
// 6. Expenses
// ---------------------------------------------------------------------------
router.post('/expenses', createExpenseHandler);
router.get('/expenses', listExpensesHandler);

// ---------------------------------------------------------------------------
// 7. Services & Users Catalog
// ---------------------------------------------------------------------------
router.get('/services', async (req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
    res.status(200).json({ status: 'success', data: services });
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const { role } = req.query;
    const where = { is_active: true };
    if (role) {
      where.role = role;
    }
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        role: true,
        commission_rate: true,
      },
      orderBy: { name: 'asc' },
    });
    res.status(200).json({ status: 'success', data: users });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 7.1 Gamified Staff Leaderboard
// ---------------------------------------------------------------------------
router.get('/leaderboard', async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const workers = await prisma.user.findMany({
      where: { role: 'Worker', is_active: true },
    });

    const completedJobsToday = await prisma.jobCard.findMany({
      where: {
        status: 'Completed',
        updated_at: { gte: startOfDay },
        worker_id: { not: null },
      },
      include: {
        services: true,
      },
    });

    const leaderboard = workers.map((worker) => {
      const workerJobs = completedJobsToday.filter((j) => j.worker_id === worker.id);
      const totalServicesRevenue = workerJobs.reduce((sum, job) => {
        const jobTotal = job.services.reduce((sSum, s) => sSum + parseFloat(s.price_charged), 0);
        return sum + jobTotal;
      }, 0);

      const commissionRate = parseFloat(worker.commission_rate) || 0;
      const commissionEarned = parseFloat(((totalServicesRevenue * commissionRate) / 100).toFixed(2));

      return {
        id: worker.id,
        name: worker.name,
        role: worker.role,
        commission_rate: commissionRate,
        cars_completed: workerJobs.length,
        total_revenue_generated: totalServicesRevenue,
        estimated_commission: commissionEarned,
      };
    });

    leaderboard.sort((a, b) => b.cars_completed - a.cars_completed || b.estimated_commission - a.estimated_commission);

    res.status(200).json({
      status: 'success',
      data: leaderboard,
      as_of: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 8. Core Ledger & Direct Endpoints
// ---------------------------------------------------------------------------
router.get('/ledger', async (req, res, next) => {
  try {
    const accounts = await prisma.ledger.findMany({
      orderBy: { account_type: 'asc' },
    });
    res.status(200).json({ status: 'success', data: accounts });
  } catch (err) {
    next(err);
  }
});

router.post('/payment', async (req, res, next) => {
  try {
    const { amount, payment_method, customer_phone, invoice_number, vehicle_plate, services_summary, notes } = req.body;
    if (amount === undefined || amount === null || !payment_method) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: "amount" and "payment_method" are required.',
      });
    }

    const result = await processPayment(amount, payment_method, {
      customer_phone,
      invoice_number,
      vehicle_plate,
      services_summary,
      description: notes,
    });

    return res.status(200).json({
      status: 'success',
      account_type: result.account_type,
      previous_balance: result.previous_balance,
      amount_changed: result.amount_changed,
      new_balance: result.new_balance,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/expense', async (req, res, next) => {
  try {
    const { amount, payment_method, category, description } = req.body;
    if (amount === undefined || amount === null || !payment_method) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: "amount" and "payment_method" are required.',
      });
    }

    const result = await recordExpense(amount, payment_method, { category, description });

    return res.status(200).json({
      status: 'success',
      account_type: result.account_type,
      previous_balance: result.previous_balance,
      amount_changed: result.amount_changed,
      new_balance: result.new_balance,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
