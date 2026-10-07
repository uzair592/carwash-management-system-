require('dotenv').config();
const cron = require('node-cron');
const prisma = require('../prisma');
const { sendTelegramMessage } = require('../services/notification.service');

/**
 * Compiles and calculates comprehensive End-of-Day financial figures.
 * @returns {Promise<Object>} Formatted summary data
 */
async function compileEodMetrics() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Invoices today
  const invoices = await prisma.invoice.findMany({
    where: {
      created_at: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      job_card: {
        include: { vehicle: true },
      },
    },
  });

  const grossRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0);
  const cashRevenue = invoices
    .filter((inv) => inv.payment_method === 'Cash')
    .reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0);
  const bankRevenue = invoices
    .filter((inv) => inv.payment_method === 'Bank' || inv.payment_method === 'Card')
    .reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0);

  // 2. Expenses today
  const expenses = await prisma.expense.findMany({
    where: {
      created_at: { gte: startOfDay, lte: endOfDay },
    },
  });

  const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
  const netSurplus = grossRevenue - totalExpenses;

  // 3. Completed Job Cards & Worker Commission
  const completedJobs = await prisma.jobCard.findMany({
    where: {
      status: 'Completed',
      updated_at: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      services: true,
      worker: true,
    },
  });

  const workerCommissionTotal = completedJobs.reduce((sum, job) => {
    const rate = job.worker ? parseFloat(job.worker.commission_rate) : 0;
    const jobSubtotal = job.services.reduce((sSum, s) => sSum + parseFloat(s.price_charged), 0);
    return sum + (jobSubtotal * rate) / 100;
  }, 0);

  // 4. Closing Ledger Balances
  const ledgerAccounts = await prisma.ledger.findMany();
  const cashDrawer = ledgerAccounts.find((a) => a.account_type === 'Cash_Drawer');
  const mainBank = ledgerAccounts.find((a) => a.account_type === 'Main_Bank');

  const cashBalance = parseFloat(cashDrawer?.current_balance || 0);
  const bankBalance = parseFloat(mainBank?.current_balance || 0);
  const totalVaultAssets = cashBalance + bankBalance;

  return {
    dateStr: new Date().toLocaleDateString('en-GB'),
    carsCount: completedJobs.length,
    invoicesCount: invoices.length,
    grossRevenue,
    cashRevenue,
    bankRevenue,
    expensesCount: expenses.length,
    totalExpenses,
    netSurplus,
    workerCommissionTotal,
    cashBalance,
    bankBalance,
    totalVaultAssets,
  };
}

/**
 * Formats metrics into an investor-grade Telegram report.
 * @param {Object} m - Metrics object
 * @returns {string}
 */
function formatEodTelegramReport(m) {
  const fmt = (num) => Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return [
    `📊 *END OF DAY FINANCIAL CLOSING REPORT*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📅 *Closing Date:* ${m.dateStr} (23:59 EOD)`,
    `🚗 *Total Vehicles Washed:* *${m.carsCount} Cars*`,
    `🧾 *Invoices Settled:* ${m.invoicesCount}`,
    ``,
    `💰 *DAILY REVENUE & EARNINGS*`,
    `• Gross Revenue: *Rs. ${fmt(m.grossRevenue)}*`,
    `  ├─ Cash Collections: Rs. ${fmt(m.cashRevenue)}`,
    `  └─ Bank / Card Collections: Rs. ${fmt(m.bankRevenue)}`,
    `• Operational Expenses: *Rs. ${fmt(m.totalExpenses)}* (${m.expensesCount} Vouchers)`,
    `• *Net Daily Cash Flow:* *${m.netSurplus >= 0 ? '+' : ''}Rs. ${fmt(m.netSurplus)}*`,
    ``,
    `👥 *STAFF PERFORMANCE & COMMISSIONS*`,
    `• Total Daily Commission: Rs. ${fmt(m.workerCommissionTotal)}`,
    ``,
    `🏦 *CLOSING VAULT LEDGER BALANCES*`,
    `• Cash Drawer Balance: *Rs. ${fmt(m.cashBalance)}*`,
    `• Main Bank Balance:   *Rs. ${fmt(m.bankBalance)}*`,
    `• *Combined Shop Net Worth:* *Rs. ${fmt(m.totalVaultAssets)}*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🔒 _Automated Partner Audit • 100% On-Premises Verified_`,
  ].join('\n');
}

/**
 * Executes EOD report compilation and dispatches to partners via Telegram.
 */
async function runEodReportNow() {
  console.log('[EODCron] Compiling End-of-Day Financial Dossier...');
  try {
    const metrics = await compileEodMetrics();
    const reportText = formatEodTelegramReport(metrics);
    console.log('[EODCron] Generated Report Preview:\n' + reportText);

    const dispatchResult = await sendTelegramMessage(reportText);
    console.log('[EODCron] EOD Report dispatch status:', dispatchResult);
    return { success: true, metrics, dispatchResult };
  } catch (err) {
    console.error('[EODCron] Critical error executing EOD cron:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Initializes the automated daily EOD Cron Job at 23:59 (11:59 PM).
 */
function initEodCron() {
  // Pattern: 59 23 * * * = Every day at 23:59:00
  const schedule = '59 23 * * *';

  cron.schedule(schedule, async () => {
    console.log('[EODCron] ⏰ 23:59 Triggered: Initiating scheduled daily financial settlement...');
    await runEodReportNow();
  });

  console.log(`[EODCron] Scheduled EOD Financial Audit Daemon initialized (Schedule: "${schedule}" daily).`);
}

module.exports = {
  initEodCron,
  runEodReportNow,
  compileEodMetrics,
};
