const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { processPayment, recordExpense } = require('../services/ledger.service');

/**
 * Health check endpoint
 * GET /api/health
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Car Wash Management System API',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Audit endpoint: View all ledger balances
 * GET /api/ledger
 */
router.get('/ledger', async (req, res, next) => {
  try {
    const balances = await prisma.ledger.findMany({
      orderBy: { account_type: 'asc' },
    });
    res.status(200).json({
      status: 'success',
      data: balances,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Record customer payment inflow
 * POST /api/payment
 * Body: { amount: number, payment_method: "Cash" | "Card" }
 * Response: { previous_balance, amount_changed, new_balance }
 */
router.post('/payment', async (req, res, next) => {
  try {
    const { amount, payment_method, customer_phone, invoice_number, vehicle_plate, services_summary, notes } = req.body;

    if (amount === undefined || amount === null || !payment_method) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: "amount" and "payment_method" ("Cash" or "Card") are required.',
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
      message: 'Payment processed and ledger updated atomically.',
      account_type: result.account_type,
      previous_balance: result.previous_balance,
      amount_changed: result.amount_changed,
      new_balance: result.new_balance,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Record operational expense outflow
 * POST /api/expense
 * Body: { amount: number, payment_method: "Cash" | "Card", category?: string, description?: string }
 * Response: { previous_balance, amount_changed, new_balance }
 */
router.post('/expense', async (req, res, next) => {
  try {
    const { amount, payment_method, category, description } = req.body;

    if (amount === undefined || amount === null || !payment_method) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: "amount" and "payment_method" ("Cash" or "Card") are required.',
      });
    }

    const result = await recordExpense(amount, payment_method, {
      category,
      description,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Expense recorded and ledger deducted atomically.',
      account_type: result.account_type,
      previous_balance: result.previous_balance,
      amount_changed: result.amount_changed,
      new_balance: result.new_balance,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
