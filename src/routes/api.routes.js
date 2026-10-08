const express = require('express');
const router = express.Router();
const prisma = require('../prisma');

// Controllers
const {
  getSettingsHandler,
  updateSettingsHandler
} = require('../controllers/settings.controller');
const {
  vehicleIntakeHandler,
  getVehicleHandler
} = require('../controllers/vehicle.controller');
const {
  updateJobCardStatusHandler,
  listJobCardsHandler,
  getJobCardHandler
} = require('../controllers/jobcard.controller');
const {
  checkoutHandler,
  listInvoicesHandler,
  reversePaymentHandler,
  collectPaymentHandler
} = require('../controllers/invoice.controller');
const {
  createExpenseHandler,
  listExpensesHandler
} = require('../controllers/expense.controller');
const {
  processPayment,
  recordExpense
} = require('../services/ledger.service');
const dashboardRoutes = require('./dashboard.routes');
const payrollRoutes = require('./payroll.routes');
const {
  listInventoryHandler,
  createInventoryHandler,
  updateInventoryHandler,
  restockInventoryHandler,
  linkServiceInventoryHandler
} = require('../controllers/inventory.controller');
const {
  upload,
  validateImage
} = require('../services/upload.service');
const {
  uploadJobCardMediaHandler,
  getJobCardMediaHandler,
  deleteJobCardMediaHandler
} = require('../controllers/media.controller');
const {
  rapidIntakeHandler,
  checkPlateHandler,
  startJobCardHandler,
  completeJobCardHandler,
  getLiveBayStatusHandler,
  verifyAdminPinHandler,
  issueRefundHandler
} = require('../controllers/physical-bays.controller');
const {
  getCurrentSessionHandler,
  openSessionHandler,
  closeSessionHandler,
  getHistorySessionsHandler
} = require('../controllers/register.controller');
const {
  generateThermalIntakeTicket,
  generateThermalCustomerReceipt
} = require('../services/printer.service');
const {
  getMonthlyPayrollHandler,
  getPartnerEquityHandler,
  upsertPartnerEquityHandler,
  getMonthlyDividendsHandler,
  dispatchDividendsHandler,
  listYieldMappingsHandler,
  createYieldMappingHandler
} = require('../controllers/financials.controller');
const {
  authenticateUser,
  requireRole
} = require('../middleware/auth.middleware');
const {
  listAuditLogsHandler
} = require('../controllers/audit.controller');
const {
  createDepositHandler,
  listDepositsHandler,
  listActiveDepositsHandler
} = require('../controllers/deposit.controller');
const {
  createTransferHandler,
  listTransfersHandler
} = require('../controllers/transfer.controller');
const {
  issueMaterialHandler,
  getJobCardMaterialsHandler
} = require('../controllers/material.controller');
const {
  createPartnerTransactionHandler,
  getPartnerTransactionsHandler,
  listAllPartnerTransactionsHandler
} = require('../controllers/partner-tx.controller');
const {
  listBankAccountsHandler,
  createBankAccountHandler,
  updateBankAccountHandler,
  deleteBankAccountHandler,
  getBankAccountTransactionsHandler
} = require('../controllers/bank.controller');
const {
  getBrandingHandler,
  updateBrandingHandler,
  uploadLogoHandler,
  removeLogoHandler
} = require('../controllers/branding.controller');
const {
  loginHandler,
  listUsersHandler,
  createUserHandler,
  updateUserHandler,
  resetPasswordHandler,
  updatePinHandler,
  toggleUserStatusHandler
} = require('../controllers/user.controller');
const {
  listServicesHandler,
  createServiceHandler,
  updateServiceHandler,
  overrideJobCardServicePriceHandler
} = require('../controllers/service.controller');
const {
  listCustomersHandler
} = require('../controllers/customer.controller');
const {
  getReportsSummaryHandler
} = require('../controllers/reports.controller');

// ---------------------------------------------------------------------------
// 1. Health & Service Diagnostics (Public)
// ---------------------------------------------------------------------------
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'DF PRO Car Wash & Detailing Management System Core API',
    timestamp: new Date().toISOString()
  });
});

// Authentication endpoint (Public login)
router.post('/auth/login', loginHandler);

// Authenticate user across all subsequent API routes
router.use(authenticateUser);
router.get('/auth/me', (req, res) => res.json({
  status: 'success',
  user: req.user
}));
router.post('/auth/logout', async (req, res, next) => {
  try {
    await prisma.user.update({
      where: {
        id: req.user.id
      },
      data: {
        session_version: {
          increment: 1
        }
      }
    });
    res.clearCookie('dfpro_session');
    res.json({
      status: 'success'
    });
  } catch (e) {
    next(e);
  }
});
router.use((req, res, next) => {
  if (req.user.role === 'INVESTOR') return req.method === 'GET' && ['/dashboard/live', '/branding'].includes(req.path) ? next() : res.status(403).json({
    status: 'error',
    message: 'Investor accounts are read-only.'
  });
  if (req.user.role !== 'WORKER') return next();
  const read = req.method === 'GET' && /^(\/bays\/|\/job-cards(?:\/|$)|\/services$|\/users$|\/branding$|\/inventory$|\/materials\/job-card\/|\/leaderboard$)/.test(req.path);
  const work = req.method === 'PATCH' && /^\/job-cards\/[^/]+\/(start|complete)$/.test(req.path) || req.method === 'POST' && (req.path === '/materials/issue' || /^\/job-cards\/[^/]+\/media$/.test(req.path));
  return read || work ? next() : res.status(403).json({
    status: 'error',
    message: 'Worker access is limited to workshop tasks.'
  });
});
router.post('/auth/verify-pin', verifyAdminPinHandler);

// ---------------------------------------------------------------------------
// 2. Dynamic Feature Flags & Investor Dashboard
// ---------------------------------------------------------------------------
router.get('/settings', requireRole(['ADMIN', 'MANAGER']), getSettingsHandler);
router.patch('/settings', requireRole(['ADMIN', 'MANAGER']), updateSettingsHandler);
router.use('/dashboard', dashboardRoutes);

// ---------------------------------------------------------------------------
// 3. Vehicles & Physical Intake ("No-Ticket, No-Work" Entry Point)
// ---------------------------------------------------------------------------
router.post('/intake', rapidIntakeHandler);
router.post('/vehicles/intake', rapidIntakeHandler); // backward compatibility alias
router.get('/vehicles/:registration', getVehicleHandler);
router.get('/vehicles/lookup/:plate', checkPlateHandler);
router.get('/bays/check-plate/:plate', checkPlateHandler);
router.get('/customers', listCustomersHandler);
router.get('/camera/arrivals', requireRole(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res, next) => {
  try {
    res.json({
      status: 'success',
      data: await prisma.cameraArrival.findMany({
        orderBy: {
          arrived_at: 'desc'
        },
        take: 10
      })
    });
  } catch (e) {
    next(e);
  }
});
router.get('/loyalty', listCustomersHandler);
router.get('/reports/summary', requireRole(['ADMIN', 'MANAGER']), getReportsSummaryHandler);

// ---------------------------------------------------------------------------
// 4. Physical Work Areas (Jack 1, Jack 2, Detailing Bays 1 & 2) & Job Cards
// ---------------------------------------------------------------------------
router.get('/bays/live-status', getLiveBayStatusHandler);
router.patch('/job-cards/:id/start', startJobCardHandler);
router.patch('/job-cards/:id/complete', completeJobCardHandler);
router.get('/job-cards', listJobCardsHandler);
router.get('/job-cards/:id', getJobCardHandler);
router.patch('/job-cards/:id/status', updateJobCardStatusHandler);
router.post('/admin/verify-pin', verifyAdminPinHandler);
router.post('/invoices/:id/refund', issueRefundHandler);
router.patch('/job-cards/:jobCardId/services/:serviceId/price-override', overrideJobCardServicePriceHandler);

// ---------------------------------------------------------------------------
// 4b. Cash Register Sessions (Shift Open / Close / Variance Reconciliation)
// ---------------------------------------------------------------------------
router.get('/register/current', getCurrentSessionHandler);
router.post('/register/open', requireRole(['ADMIN', 'MANAGER']), openSessionHandler);
router.post('/register/close', requireRole(['ADMIN', 'MANAGER']), closeSessionHandler);
router.get('/register/history', getHistorySessionsHandler);

// ---------------------------------------------------------------------------
// 4c. Thermal Printing Endpoints (80mm ESC/POS with Branding Logo)
// ---------------------------------------------------------------------------
router.post('/printer/thermal-ticket', async (req, res, next) => {
  try {
    const result = await generateThermalIntakeTicket(req.body);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
});
router.post('/printer/thermal-receipt', async (req, res, next) => {
  try {
    const result = await generateThermalCustomerReceipt(req.body);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 5. Checkout & Invoicing
// ---------------------------------------------------------------------------
router.post('/invoices/checkout', checkoutHandler);
router.post('/checkout', checkoutHandler); // convenience alias
router.post('/invoices/:id/reverse-payment', reversePaymentHandler);
router.get('/invoices', listInvoicesHandler);
router.post('/invoices/:id/payments', collectPaymentHandler);

// ---------------------------------------------------------------------------
// 6. Expenses
// ---------------------------------------------------------------------------
router.post('/expenses', createExpenseHandler);
router.get('/expenses', listExpensesHandler);

// ---------------------------------------------------------------------------
// 7. Services Catalog (Editable blocks & independent pricing)
// ---------------------------------------------------------------------------
router.get('/services', listServicesHandler);
router.post('/services', requireRole(['ADMIN', 'MANAGER']), createServiceHandler);
router.put('/services/:id', requireRole(['ADMIN', 'MANAGER']), updateServiceHandler);
router.patch('/services/:id', requireRole(['ADMIN', 'MANAGER']), updateServiceHandler);

// ---------------------------------------------------------------------------
// 7b. Staff User Management (Credentials, PINs, Roles, Status)
// ---------------------------------------------------------------------------
router.get('/users', listUsersHandler);
router.post('/users', requireRole(['ADMIN']), createUserHandler);
router.put('/users/:id', requireRole(['ADMIN']), updateUserHandler);
router.post('/users/:id/reset-password', resetPasswordHandler);
router.post('/users/:id/update-pin', requireRole(['ADMIN']), updatePinHandler);
router.patch('/users/:id/toggle-status', requireRole(['ADMIN']), toggleUserStatusHandler);

// ---------------------------------------------------------------------------
// 7.1 Gamified Staff Leaderboard
// ---------------------------------------------------------------------------
router.get('/leaderboard', async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const workers = await prisma.user.findMany({
      where: {
        role: 'Worker',
        is_active: true
      },
      select: {
        id: true,
        name: true,
        role: true,
        commission_rate: true
      }
    });
    const completedJobsToday = await prisma.jobCard.findMany({
      where: {
        status: {
          in: ['Completed', 'COMPLETED']
        },
        updated_at: {
          gte: startOfDay
        },
        worker_id: {
          not: null
        }
      },
      include: {
        services: true
      }
    });
    const leaderboard = workers.map(worker => {
      const workerJobs = completedJobsToday.filter(j => j.worker_id === worker.id);
      const totalServicesRevenue = workerJobs.reduce((sum, job) => {
        const jobTotal = job.services.reduce((sSum, s) => sSum + parseFloat(s.price_charged), 0);
        return sum + jobTotal;
      }, 0);
      const commissionRate = parseFloat(worker.commission_rate) || 0;
      const commissionEarned = parseFloat((totalServicesRevenue * commissionRate / 100).toFixed(2));
      return {
        id: worker.id,
        name: worker.name,
        role: worker.role,
        commission_rate: commissionRate,
        cars_completed: workerJobs.length,
        total_revenue_generated: totalServicesRevenue,
        estimated_commission: commissionEarned
      };
    });
    leaderboard.sort((a, b) => b.cars_completed - a.cars_completed || b.estimated_commission - a.estimated_commission);
    res.status(200).json({
      status: 'success',
      data: leaderboard,
      as_of: new Date().toISOString()
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
      orderBy: {
        account_type: 'asc'
      }
    });
    res.status(200).json({
      status: 'success',
      data: accounts
    });
  } catch (err) {
    next(err);
  }
});
router.post('/payment', (req, res) => res.status(410).json({
  status: 'error',
  message: 'Collect payments through an invoice.'
}));
router.post('/expense', createExpenseHandler);

// ---------------------------------------------------------------------------
// 8b. Multiple Bank Accounts
// ---------------------------------------------------------------------------
router.get('/banks', listBankAccountsHandler);
router.post('/banks', requireRole(['ADMIN']), createBankAccountHandler);
router.put('/banks/:id', requireRole(['ADMIN']), updateBankAccountHandler);
router.delete('/banks/:id', requireRole(['ADMIN']), deleteBankAccountHandler);
router.get('/banks/:id/transactions', getBankAccountTransactionsHandler);

// ---------------------------------------------------------------------------
// 8c. Business Branding & Logo Settings
// ---------------------------------------------------------------------------
router.get('/branding', getBrandingHandler);
router.patch('/branding', requireRole(['ADMIN', 'MANAGER']), updateBrandingHandler);
router.post('/branding/logo', requireRole(['ADMIN', 'MANAGER']), upload.single('logo'), validateImage, uploadLogoHandler);
router.delete('/branding/logo', requireRole(['ADMIN', 'MANAGER']), removeLogoHandler);

// ---------------------------------------------------------------------------
// 9. Monthly Staff Payroll Engine (Admin Only)
// ---------------------------------------------------------------------------
router.use('/payroll', requireRole(['ADMIN']), payrollRoutes);

// ---------------------------------------------------------------------------
// 10. Consumables & Inventory Yield Management (Manager & Admin)
// ---------------------------------------------------------------------------
router.get('/inventory', listInventoryHandler);
router.post('/inventory', requireRole(['ADMIN', 'MANAGER']), createInventoryHandler);
router.patch('/inventory/:id', requireRole(['ADMIN', 'MANAGER']), updateInventoryHandler);
router.post('/inventory/:id/restock', requireRole(['ADMIN', 'MANAGER']), restockInventoryHandler);
router.patch('/services/:id/link-inventory', requireRole(['ADMIN', 'MANAGER']), linkServiceInventoryHandler);

// ---------------------------------------------------------------------------
// 11. Digital Vehicle Inspection & Liability Media Uploads
// ---------------------------------------------------------------------------
router.post('/job-cards/:id/media', upload.single('image'), validateImage, uploadJobCardMediaHandler);
router.get('/job-cards/:id/media', getJobCardMediaHandler);
router.delete('/job-cards/media/:mediaId', requireRole(['ADMIN', 'MANAGER']), deleteJobCardMediaHandler);

// ---------------------------------------------------------------------------
// 12. Monthly Financial Engine: Payroll, Yield Mappings & Partner Equity (Admin Only)
// ---------------------------------------------------------------------------
router.get('/financials/payroll', requireRole(['ADMIN']), getMonthlyPayrollHandler);
router.get('/financials/equity', requireRole(['ADMIN']), getPartnerEquityHandler);
router.post('/financials/equity', requireRole(['ADMIN']), upsertPartnerEquityHandler);
router.get('/financials/dividends', requireRole(['ADMIN']), getMonthlyDividendsHandler);
router.post('/financials/dividends/dispatch', requireRole(['ADMIN']), dispatchDividendsHandler);
router.get('/inventory/yield-mappings', listYieldMappingsHandler);
router.post('/inventory/yield-mappings', requireRole(['ADMIN', 'MANAGER']), createYieldMappingHandler);

// ---------------------------------------------------------------------------
// 13. Immutable Shop Audit Log (Admin Only)
// ---------------------------------------------------------------------------
router.get('/alerts', requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    res.json({
      status: 'success',
      data: await prisma.alertOutbox.findMany({
        where: {
          status: {
            not: 'SENT'
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        take: 50
      })
    });
  } catch (e) {
    next(e);
  }
});
router.post('/alerts/:id/retry', requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    await prisma.alertOutbox.updateMany({
      where: {
        id: req.params.id,
        status: {
          in: ['FAILED', 'PENDING']
        }
      },
      data: {
        status: 'PENDING',
        next_attempt_at: new Date(),
        error_message: null
      }
    });
    res.json({
      status: 'success'
    });
  } catch (e) {
    next(e);
  }
});
router.get('/audit-logs', requireRole(['ADMIN']), listAuditLogsHandler);

// ---------------------------------------------------------------------------
// 14. Customer Advances & Deposits (Liabilities)
// ---------------------------------------------------------------------------
router.post('/deposits', createDepositHandler);
router.get('/deposits', listDepositsHandler);
router.get('/deposits/active', listActiveDepositsHandler);

// ---------------------------------------------------------------------------
// 15. Ledger Transfers (Cash-to-Bank Vault Balancing)
// ---------------------------------------------------------------------------
router.post('/ledger/transfer', requireRole(['ADMIN', 'MANAGER']), createTransferHandler);
router.get('/ledger/transfers', requireRole(['ADMIN', 'MANAGER']), listTransfersHandler);

// ---------------------------------------------------------------------------
// 16. Multi-Day Inventory Material Issuance (Decoupled Consumable Tracking)
// ---------------------------------------------------------------------------
router.post('/materials/issue', issueMaterialHandler);
router.get('/materials/job-card/:id', getJobCardMaterialsHandler);

// ---------------------------------------------------------------------------
// 17. Partner Capital & Drawings Ledger (P&L Neutral)
// ---------------------------------------------------------------------------
router.post('/partners/:id/transactions', requireRole(['ADMIN']), createPartnerTransactionHandler);
router.get('/partners/:id/transactions', requireRole(['ADMIN']), getPartnerTransactionsHandler);
router.get('/partners/transactions', requireRole(['ADMIN']), listAllPartnerTransactionsHandler);
module.exports = router;
