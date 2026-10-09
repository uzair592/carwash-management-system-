const express = require('express');
const router = express.Router();
const { generatePayrollHandler, updateStaffSalaryHandler } = require('../controllers/payroll.controller');

// GET /api/payroll/generate?month=YYYY-MM
router.get('/generate', generatePayrollHandler);

// PATCH /api/payroll/users/:id/salary
router.patch('/users/:id/salary', updateStaffSalaryHandler);

module.exports = router;

const overtime = require('../controllers/overtime.controller');
router.get('/overtime-workers', overtime.workers);
router.get('/overtime', overtime.list);
router.post('/overtime', overtime.save);
router.put('/overtime/:id', overtime.save);
router.delete('/overtime/:id', overtime.remove);
