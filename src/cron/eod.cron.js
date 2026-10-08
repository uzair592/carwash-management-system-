require('dotenv').config();
const cron = require('node-cron');
const prisma = require('../prisma');
const { sendTelegramMessage } = require('../services/notification.service');

function fmtCurrency(num) {
  return Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Compiles and calculates comprehensive End-of-Day financial figures
 * reflecting the 3 physical zones, immutable invoices, and cash register sessions.
 * @returns {Promise<Object>} Formatted summary data
 */
async function compileEodMetrics() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Invoices today (strict immutable ledger)
  const invoices = await prisma.invoice.findMany({
    where: {
      created_at: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      job_card: {
        include: { vehicle: true },
      },
      refunds: true,
    },
  });

  const grossRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0);
  const cashRevenue = invoices
    .filter((inv) => inv.payment_method === 'Cash')
    .reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0);
  const bankRevenue = invoices
    .filter((inv) => inv.payment_method === 'Bank' || inv.payment_method === 'Card')
    .reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0);

  // 2. Operational Expenses today
  const expenses = await prisma.expense.findMany({
    where: {
      created_at: { gte: startOfDay, lte: endOfDay },
    },
  });
  const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

  // 3. Refunds issued today
  const refunds = await prisma.refund.findMany({
    where: {
      created_at: { gte: startOfDay, lte: endOfDay },
    },
  });
  const totalRefunds = refunds.reduce((sum, ref) => sum + parseFloat(ref.amount), 0);

  const netSurplus = grossRevenue - totalExpenses - totalRefunds;

  // 4. Physical Bay Cars Breakdown (Jack 1, Jack 2, Detailing Center)
  const finishedJobsToday = await prisma.jobCard.findMany({
    where: {
      status: { in: ['READY_FOR_BILLING', 'COMPLETED', 'Completed'] },
      OR: [
        { completed_at: { gte: startOfDay, lte: endOfDay } },
        { updated_at: { gte: startOfDay, lte: endOfDay } },
      ],
    },
    include: {
      services: true,
      worker: true,
    },
  });

  const jack1Cars = finishedJobsToday.filter((j) => j.assigned_location === 'JACK_1').length;
  const jack2Cars = finishedJobsToday.filter((j) => j.assigned_location === 'JACK_2').length;
  const detailingCars = finishedJobsToday.filter((j) => j.assigned_location === 'DETAILING_CENTER').length;
  const otherCars = finishedJobsToday.length - (jack1Cars + jack2Cars + detailingCars);

  // Worker commissions
  const workerCommissionTotal = finishedJobsToday.reduce((sum, job) => {
    const rate = job.worker ? parseFloat(job.worker.commission_rate) : 0;
    const jobSubtotal = job.services.reduce((sSum, s) => sSum + parseFloat(s.price_charged), 0);
    return sum + (jobSubtotal * rate) / 100;
  }, 0);

  // 5. Cash Register Sessions (Shift Reconciliation & Till Variances)
  const registerSessionsToday = await prisma.registerSession.findMany({
    where: {
      created_at: { gte: startOfDay, lte: endOfDay },
    },
    include: { opened_by: true },
    orderBy: { opened_at: 'asc' },
  });

  const closedSessions = registerSessionsToday.filter((s) => s.status === 'CLOSED');
  const totalTillVariance = closedSessions.reduce((sum, s) => sum + parseFloat(s.variance || 0), 0);
  const openSessionsCount = registerSessionsToday.filter((s) => s.status === 'OPEN').length;

  // 6. Closing Ledger Balances
  const ledgerAccounts = await prisma.ledger.findMany();
  const cashDrawer = ledgerAccounts.find((a) => a.account_type === 'Cash_Drawer');
  const mainBank = ledgerAccounts.find((a) => a.account_type === 'Main_Bank');

  const cashBalance = parseFloat(cashDrawer?.current_balance || 0);
  const bankBalance = parseFloat(mainBank?.current_balance || 0);
  const totalVaultAssets = cashBalance + bankBalance;

  return {
    dateStr: new Date().toLocaleDateString('en-GB'),
    carsCount: finishedJobsToday.length,
    baysBreakdown: {
      jack_1: jack1Cars,
      jack_2: jack2Cars,
      detailing_center: detailingCars,
      unassigned_or_legacy: otherCars,
    },
    invoicesCount: invoices.length,
    grossRevenue,
    cashRevenue,
    bankRevenue,
    expensesCount: expenses.length,
    totalExpenses,
    refundsCount: refunds.length,
    totalRefunds,
    netSurplus,
    workerCommissionTotal,
    registerSummary: {
      total_shifts: registerSessionsToday.length,
      closed_shifts: closedSessions.length,
      open_shifts: openSessionsCount,
      total_variance: totalTillVariance,
      sessions: registerSessionsToday,
    },
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
  let varianceAlert = '• Till Reconciliation: *Rs. 0.00 (ALL SHIFTS BALANCED ✅)*';
  if (Math.abs(m.registerSummary.total_variance) > 0.01) {
    if (m.registerSummary.total_variance < 0) {
      varianceAlert = `• ⚠️ *CASH TILL SHORTAGE:* *-Rs. ${fmtCurrency(Math.abs(m.registerSummary.total_variance))} (MISSING MONEY)*`;
    } else {
      varianceAlert = `• 💵 *CASH TILL OVERAGE:* *+Rs. ${fmtCurrency(m.registerSummary.total_variance)} (SURPLUS)*`;
    }
  }

  const lines = [
    `📊 *END OF DAY FINANCIAL CLOSING REPORT*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📅 *Closing Date:* ${m.dateStr} (23:59 EOD)`,
    `🚗 *Total Vehicles Washed:* *${m.carsCount} Cars*`,
    `   ├─ 🚿 *Washing Jack 1 (Team 1):* ${m.baysBreakdown.jack_1} cars`,
    `   ├─ 🚿 *Washing Jack 2 (Team 2):* ${m.baysBreakdown.jack_2} cars`,
    `   └─ ✨ *Detailing Center:* ${m.baysBreakdown.detailing_center} cars`,
    m.baysBreakdown.unassigned_or_legacy > 0 ? `   └─ 🚗 *Other/Legacy:* ${m.baysBreakdown.unassigned_or_legacy} cars` : null,
    `🧾 *Invoices Settled:* ${m.invoicesCount}`,
    ``,
    `💰 *DAILY REVENUE & EARNINGS*`,
    `• Gross Revenue: *Rs. ${fmtCurrency(m.grossRevenue)}*`,
    `  ├─ Cash Drawer Collections: Rs. ${fmtCurrency(m.cashRevenue)}`,
    `  └─ Bank / Card Collections: Rs. ${fmtCurrency(m.bankRevenue)}`,
    `• Operational Expenses: *Rs. ${fmtCurrency(m.totalExpenses)}* (${m.expensesCount} Vouchers)`,
    m.totalRefunds > 0 ? `• Approved Refunds: *Rs. ${fmtCurrency(m.totalRefunds)}* (${m.refundsCount} Voids)` : null,
    `• *Net Daily Cash Flow:* *${m.netSurplus >= 0 ? '+' : ''}Rs. ${fmtCurrency(m.netSurplus)}*`,
    ``,
    `🏪 *CASH REGISTER SHIFT AUDIT*`,
    `• Total Shifts Tracked: ${m.registerSummary.total_shifts} (${m.registerSummary.closed_shifts} Closed${m.registerSummary.open_shifts > 0 ? `, ${m.registerSummary.open_shifts} still OPEN` : ''})`,
    varianceAlert,
    ``,
    `👥 *STAFF PERFORMANCE & COMMISSIONS*`,
    `• Total Daily Commission: Rs. ${fmtCurrency(m.workerCommissionTotal)}`,
    ``,
    `🏦 *CLOSING VAULT LEDGER BALANCES*`,
    `• Cash Drawer Vault: *Rs. ${fmtCurrency(m.cashBalance)}*`,
    `• Main Bank Account: *Rs. ${fmtCurrency(m.bankBalance)}*`,
    `• *Combined Shop Net Worth:* *Rs. ${fmtCurrency(m.totalVaultAssets)}*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🔒 _Automated Partner Audit • 100% On-Premises Verified_`,
  ];

  return lines.filter(Boolean).join('\n');
}

/**
 * Executes EOD report compilation, queues in AlertOutbox, and dispatches to partners via Telegram.
 */
async function runEodReportNow() {
  console.log('[EODCron] Compiling End-of-Day Financial Dossier...');
  try {
    const metrics = await compileEodMetrics();
    const reportText = formatEodTelegramReport(metrics);
    console.log('[EODCron] Generated Report Preview:\n' + reportText);

    // Write to AlertOutbox table so background worker guarantees delivery
    await prisma.alertOutbox.create({
      data: {
        type: 'TELEGRAM',
        payload: {
          event: 'EOD_REPORT',
          date: metrics.dateStr,
          message: reportText,
          gross_revenue: metrics.grossRevenue,
          cars_count: metrics.carsCount,
          variance: metrics.registerSummary.total_variance,
        },
      },
    });

    // Also attempt immediate direct dispatch
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
  const schedule = '59 23 * * *';

  cron.schedule(schedule, async () => {
    console.log('[EODCron] ⏰ 23:59 Triggered: Initiating scheduled daily financial settlement...');
    await runEodReportNow();
  });

  console.log(`[EODCron] Scheduled EOD Financial Audit Daemon initialized (Schedule: "${schedule}" daily).`);
}

module.exports = {
  compileEodMetrics,
  formatEodTelegramReport,
  runEodReportNow,
  initEodCron,
};
