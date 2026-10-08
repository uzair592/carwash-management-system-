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
router.use(require('../services/permission.service').enforcePermissions);
const permissionController = require('../controllers/permission.controller');
router.get('/permissions', permissionController.listPermissions);
router.patch('/permissions/:id', permissionController.updatePermissions);
router.post('/auth/verify-pin', verifyAdminPinHandler);

// ---------------------------------------------------------------------------
// 2. Dynamic Feature Flags & Investor Dashboard
// ---------------------------------------------------------------------------
router.get('/settings', getSettingsHandler);
router.patch('/settings', updateSettingsHandler);
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
const masterData = require('../controllers/master-data.controller');
router.post('/customers', masterData.saveCustomer);
router.patch('/customers/:id', masterData.saveCustomer);
router.delete('/customers/:id', masterData.deleteCustomer);
router.get('/camera/arrivals', async (req, res, next) => {
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
router.get('/reports/summary', getReportsSummaryHandler);

// ---------------------------------------------------------------------------
// 4. Physical Work Areas (Jack 1, Jack 2, Detailing Bays 1 & 2) & Job Cards
// ---------------------------------------------------------------------------
router.get('/bays/live-status', getLiveBayStatusHandler);
router.patch('/job-cards/:id/start', startJobCardHandler);
router.patch('/job-cards/:id/complete', completeJobCardHandler);
router.get('/job-cards', listJobCardsHandler);
router.get('/job-cards/:id', getJobCardHandler);
router.patch('/job-cards/:id/status', updateJobCardStatusHandler);
router.put('/job-cards/:id/services', require('../controllers/job-services.controller').updateJobServices);
router.post('/admin/verify-pin', verifyAdminPinHandler);
router.post('/invoices/:id/refund', issueRefundHandler);
router.patch('/job-cards/:jobCardId/services/:serviceId/price-override', overrideJobCardServicePriceHandler);

// ---------------------------------------------------------------------------
// 4b. Cash Register Sessions (Shift Open / Close / Variance Reconciliation)
// ---------------------------------------------------------------------------
router.get('/register/current', getCurrentSessionHandler);
router.post('/register/open', openSessionHandler);
router.post('/register/close', closeSessionHandler);
router.get('/register/history', getHistorySessionsHandler);

// ---------------------------------------------------------------------------
// 4c. Thermal Printing Endpoints (80mm ESC/POS with Branding Logo)
// ---------------------------------------------------------------------------
const nativePrinter = require('../controllers/printer.controller');
router.get('/printer/settings', nativePrinter.getSettings);
router.put('/printer/settings', nativePrinter.updateSettings);
router.post('/printer/print', nativePrinter.printDocument);
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
router.post('/services', createServiceHandler);
router.put('/services/:id', updateServiceHandler);
router.patch('/services/:id', updateServiceHandler);

// ---------------------------------------------------------------------------
// 7b. Staff User Management (Credentials, PINs, Roles, Status)
// ---------------------------------------------------------------------------
router.get('/users', listUsersHandler);
router.post('/users', createUserHandler);
router.put('/users/:id', updateUserHandler);
router.post('/users/:id/reset-password', resetPasswordHandler);
router.post('/users/:id/update-pin', updatePinHandler);
router.patch('/users/:id/toggle-status', toggleUserStatusHandler);

// ---------------------------------------------------------------------------
// 7.1 Gamified Staff Leaderboard
// ---------------------------------------------------------------------------
router.get('/leaderboard', require('../controllers/staff-performance.controller').getStaffPerformance);

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
router.post('/banks', createBankAccountHandler);
router.put('/banks/:id', updateBankAccountHandler);
router.delete('/banks/:id', deleteBankAccountHandler);
router.get('/banks/:id/transactions', getBankAccountTransactionsHandler);

// ---------------------------------------------------------------------------
// 8c. Business Branding & Logo Settings
// ---------------------------------------------------------------------------
router.get('/branding', getBrandingHandler);
router.patch('/branding', updateBrandingHandler);
router.post('/branding/logo', upload.single('logo'), validateImage, uploadLogoHandler);
router.delete('/branding/logo', removeLogoHandler);

// ---------------------------------------------------------------------------
// 9. Monthly Staff Payroll Engine (Admin Only)
// ---------------------------------------------------------------------------
router.use('/payroll', payrollRoutes);

// ---------------------------------------------------------------------------
// 10. Consumables & Inventory Yield Management (Manager & Admin)
// ---------------------------------------------------------------------------
router.get('/inventory', listInventoryHandler);
router.post('/inventory', createInventoryHandler);
router.patch('/inventory/:id', updateInventoryHandler);
router.delete('/inventory/:id', masterData.deleteInventory);
router.post('/inventory/:id/restock', restockInventoryHandler);
router.patch('/services/:id/link-inventory', linkServiceInventoryHandler);

// ---------------------------------------------------------------------------
// 11. Digital Vehicle Inspection & Liability Media Uploads
// ---------------------------------------------------------------------------
router.post('/job-cards/:id/media', upload.single('image'), validateImage, uploadJobCardMediaHandler);
router.get('/job-cards/:id/media', getJobCardMediaHandler);
router.delete('/job-cards/media/:mediaId', deleteJobCardMediaHandler);

// ---------------------------------------------------------------------------
// 12. Monthly Financial Engine: Payroll, Yield Mappings & Partner Equity (Admin Only)
// ---------------------------------------------------------------------------
router.get('/financials/payroll', getMonthlyPayrollHandler);
router.get('/financials/equity', getPartnerEquityHandler);
router.post('/financials/equity', upsertPartnerEquityHandler);
router.get('/financials/dividends', getMonthlyDividendsHandler);
router.post('/financials/dividends/dispatch', dispatchDividendsHandler);
router.get('/inventory/yield-mappings', listYieldMappingsHandler);
router.post('/inventory/yield-mappings', createYieldMappingHandler);

// ---------------------------------------------------------------------------
// 13. Immutable Shop Audit Log (Admin Only)
// ---------------------------------------------------------------------------
router.get('/alerts', async (req, res, next) => {
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
router.post('/alerts/:id/retry', async (req, res, next) => {
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
router.get('/audit-logs', listAuditLogsHandler);

// ---------------------------------------------------------------------------
// 14. Customer Advances & Deposits (Liabilities)
// ---------------------------------------------------------------------------
router.post('/deposits', createDepositHandler);
router.get('/deposits', listDepositsHandler);
router.get('/deposits/active', listActiveDepositsHandler);

// ---------------------------------------------------------------------------
// 15. Ledger Transfers (Cash-to-Bank Vault Balancing)
// ---------------------------------------------------------------------------
router.post('/ledger/transfer', createTransferHandler);
router.get('/ledger/transfers', listTransfersHandler);

// ---------------------------------------------------------------------------
// 16. Multi-Day Inventory Material Issuance (Decoupled Consumable Tracking)
// ---------------------------------------------------------------------------
router.post('/materials/issue', issueMaterialHandler);
router.get('/materials/job-card/:id', getJobCardMaterialsHandler);

// ---------------------------------------------------------------------------
// 17. Partner Capital & Drawings Ledger (P&L Neutral)
// ---------------------------------------------------------------------------
router.post('/partners/:id/transactions', createPartnerTransactionHandler);
router.get('/partners/:id/transactions', getPartnerTransactionsHandler);
router.get('/partners/transactions', listAllPartnerTransactionsHandler);
module.exports = router;
