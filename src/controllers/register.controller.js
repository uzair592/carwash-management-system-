const prisma = require('../prisma');

function formatCurrency(num) {
  return Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * GET /api/register/current
 * Returns current open register session status and live expected drawer cash.
 */
async function getCurrentSessionHandler(req, res, next) {
  try {
    const session = await prisma.registerSession.findFirst({
      where: { status: 'OPEN' },
      include: { opened_by: true },
      orderBy: { opened_at: 'desc' },
    });

    if (!session) {
      // Single cashier mode: till is permanently active and synced with live cash drawer ledger
      const cashLedger = await prisma.ledger.findFirst({
        where: { account_type: 'Cash_Drawer' },
      });
      const currentCash = cashLedger ? parseFloat(cashLedger.current_balance) : 0;
      return res.status(200).json({
        status: 'success',
        data: {
          is_open: true,
          single_cashier_mode: true,
          session: {
            id: 'single-cashier-active',
            status: 'OPEN',
            opened_at: new Date(0),
            starting_cash: currentCash,
          },
          starting_cash: currentCash,
          expected_cash_in_drawer: currentCash,
        },
      });
    }

    // Calculate cash collected since session opened
    const cashInvoices = await prisma.invoice.findMany({
      where: {
        payment_method: 'Cash',
        created_at: { gte: session.opened_at },
      },
    });
    const cashCollected = cashInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0);

    // Cash expenses since session opened
    const cashExpenses = await prisma.expense.findMany({
      where: {
        payment_method: 'Cash',
        created_at: { gte: session.opened_at },
      },
    });
    const cashOutExpenses = cashExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

    // Cash refunds since session opened
    const cashRefunds = await prisma.refund.findMany({
      where: {
        created_at: { gte: session.opened_at },
        invoice: { payment_method: 'Cash' },
      },
    });
    const cashOutRefunds = cashRefunds.reduce((sum, ref) => sum + parseFloat(ref.amount), 0);

    const startingCash = parseFloat(session.starting_cash);
    const expectedCurrentCash = startingCash + cashCollected - cashOutExpenses - cashOutRefunds;

    return res.status(200).json({
      status: 'success',
      data: {
        is_open: true,
        session,
        starting_cash: startingCash,
        cash_collected: cashCollected,
        cash_outflow: cashOutExpenses + cashOutRefunds,
        expected_cash_in_drawer: expectedCurrentCash,
        invoices_count: cashInvoices.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/register/open
 * Opens a new cashier shift session with starting float cash.
 */
async function openSessionHandler(req, res, next) {
  try {
    const { starting_cash, opened_by_user_id, notes } = req.body;

    if (starting_cash === undefined || starting_cash === null || isNaN(starting_cash) || parseFloat(starting_cash) < 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid starting cash amount is required (e.g. Rs. 5,000 for change float).',
      });
    }

    // Check if a session is already OPEN
    const active = await prisma.registerSession.findFirst({
      where: { status: 'OPEN' },
      include: { opened_by: true },
    });

    if (active) {
      return res.status(409).json({
        status: 'conflict',
        message: `A register shift is already OPEN (Started at ${new Date(active.opened_at).toLocaleTimeString()}). Please close the active shift first.`,
        session: active,
      });
    }

    // Find default cashier if user ID not specified
    let userId = opened_by_user_id;
    if (!userId) {
      const defaultUser = await prisma.user.findFirst({
        where: { is_active: true },
        orderBy: { role: 'asc' },
      });
      userId = defaultUser ? defaultUser.id : null;
    }

    const startingFloat = parseFloat(starting_cash);

    const newSession = await prisma.registerSession.create({
      data: {
        starting_cash: startingFloat,
        opened_by_user_id: userId,
        status: 'OPEN',
        notes: notes || null,
      },
      include: { opened_by: true },
    });

    // Write alert to AlertOutbox table within transactional consistency
    const cashierName = newSession.opened_by?.name || 'Shop Cashier';
    const outboxMessage = [
      `🔓 *CASH REGISTER SHIFT OPENED*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Cashier:* ${cashierName}`,
      `🕒 *Time:* ${new Date(newSession.opened_at).toLocaleTimeString('en-GB')} (${new Date(newSession.opened_at).toLocaleDateString('en-GB')})`,
      `💵 *Starting Till Float:* *Rs. ${formatCurrency(startingFloat)}*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `✅ _Register Till is now active and ready for vehicle billing._`,
    ].join('\n');

    await prisma.alertOutbox.create({
      data: {
        type: 'TELEGRAM',
        payload: {
          event: 'REGISTER_OPENED',
          session_id: newSession.id,
          message: outboxMessage,
          cashier: cashierName,
          starting_cash: startingFloat,
        },
      },
    });

    return res.status(201).json({
      status: 'success',
      message: `Cash register shift opened with starting float Rs. ${formatCurrency(startingFloat)}.`,
      data: newSession,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/register/close
 * Closes the active cashier shift, reconciles physical counted cash vs expected,
 * computes variance (discrepancy), and writes Telegram partner alert to AlertOutbox.
 */
async function closeSessionHandler(req, res, next) {
  try {
    const { actual_counted_cash, notes } = req.body;

    if (actual_counted_cash === undefined || actual_counted_cash === null || isNaN(actual_counted_cash) || parseFloat(actual_counted_cash) < 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Physical counted cash amount is required to close the shift.',
      });
    }

    const session = await prisma.registerSession.findFirst({
      where: { status: 'OPEN' },
      include: { opened_by: true },
      orderBy: { opened_at: 'desc' },
    });

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'No open cash register session found to close.',
      });
    }

    const countedCash = parseFloat(actual_counted_cash);
    const startingCash = parseFloat(session.starting_cash);
    const closeTime = new Date();

    // 1. Calculate all Cash Invoices generated during this session
    const cashInvoices = await prisma.invoice.findMany({
      where: {
        payment_method: 'Cash',
        created_at: {
          gte: session.opened_at,
          lte: closeTime,
        },
      },
    });
    const cashCollections = cashInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0);

    // 2. Cash Expenses during this session
    const cashExpenses = await prisma.expense.findMany({
      where: {
        payment_method: 'Cash',
        created_at: {
          gte: session.opened_at,
          lte: closeTime,
        },
      },
    });
    const totalCashExpenses = cashExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

    // 3. Cash Refunds during this session
    const cashRefunds = await prisma.refund.findMany({
      where: {
        created_at: {
          gte: session.opened_at,
          lte: closeTime,
        },
        invoice: { payment_method: 'Cash' },
      },
    });
    const totalCashRefunds = cashRefunds.reduce((sum, ref) => sum + parseFloat(ref.amount), 0);

    const totalCashOut = totalCashExpenses + totalCashRefunds;
    const expectedClosingCash = startingCash + cashCollections - totalCashOut;
    const variance = countedCash - expectedClosingCash;

    // 4. Update the RegisterSession to CLOSED in a transaction with AlertOutbox write
    const result = await prisma.$transaction(async (tx) => {
      const closedSession = await tx.registerSession.update({
        where: { id: session.id },
        data: {
          closed_at: closeTime,
          expected_closing_cash: expectedClosingCash,
          actual_counted_cash: countedCash,
          variance: variance,
          status: 'CLOSED',
          notes: notes || session.notes || null,
        },
        include: { opened_by: true },
      });

      const cashierName = closedSession.opened_by?.name || 'Shop Cashier';

      let varianceText;
      if (Math.abs(variance) < 0.01) {
        varianceText = `Rs. 0.00 (PERFECTLY BALANCED ✅)`;
      } else if (variance < 0) {
        varianceText = `⚠️ MISSING CASH: -Rs. ${formatCurrency(Math.abs(variance))} (SHORTAGE)`;
      } else {
        varianceText = `SURPLUS CASH: +Rs. ${formatCurrency(variance)} (OVERAGE)`;
      }

      const telegramMsg = [
        `🛑 *CASH REGISTER SHIFT CLOSED*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👤 *Cashier:* ${cashierName}`,
        `🕒 *Shift Duration:* ${new Date(session.opened_at).toLocaleTimeString('en-GB')} ➔ ${closeTime.toLocaleTimeString('en-GB')}`,
        `💵 *Starting Float:* Rs. ${formatCurrency(startingCash)}`,
        `💰 *Cash Sales Collected:* Rs. ${formatCurrency(cashCollections)} (${cashInvoices.length} invoices)`,
        totalCashOut > 0 ? `🔻 *Cash Outflows:* Rs. ${formatCurrency(totalCashOut)}` : null,
        `🔢 *Expected in Till:* Rs. ${formatCurrency(expectedClosingCash)}`,
        `🖐️ *Actual Counted:* *Rs. ${formatCurrency(countedCash)}*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `⚖️ *TILL VARIANCE:* *${varianceText}*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🔒 _Audit Snapshot saved in PostgreSQL Ledger._`,
      ]
        .filter(Boolean)
        .join('\n');

      await tx.alertOutbox.create({
        data: {
          type: 'TELEGRAM',
          payload: {
            event: 'REGISTER_CLOSED',
            session_id: closedSession.id,
            cashier: cashierName,
            starting_cash: startingCash,
            expected: expectedClosingCash,
            counted: countedCash,
            variance: variance,
            message: telegramMsg,
          },
        },
      });

      // Record Audit Log if Variance Detected (Missing Money or Surplus)
      if (Math.abs(variance) >= 0.01) {
        await tx.auditLog.create({
          data: {
            action: 'REGISTER_VARIANCE',
            description: `Cash register closed with variance of ${variance < 0 ? '-' : '+'}Rs. ${Math.abs(variance).toLocaleString()} (${variance < 0 ? 'MISSING CASH / SHORTAGE' : 'CASH OVERAGE'}). Counted: Rs. ${countedCash.toLocaleString()}, Expected: Rs. ${expectedClosingCash.toLocaleString()}.`,
            performed_by_user_id: closedSession.opened_by_user_id || null,
            performed_by_name: cashierName,
            metadata: {
              session_id: closedSession.id,
              expected_closing_cash: expectedClosingCash,
              actual_counted_cash: countedCash,
              variance: variance,
            },
          },
        });
      }

      return closedSession;
    });

    return res.status(200).json({
      status: 'success',
      message: 'Cash register shift closed and reconciled successfully. Telegram alert queued.',
      data: {
        session: result,
        reconciliation: {
          starting_cash: startingCash,
          cash_collections: cashCollections,
          cash_outflows: totalCashOut,
          expected_closing_cash: expectedClosingCash,
          actual_counted_cash: countedCash,
          variance: variance,
          is_balanced: Math.abs(variance) < 0.01,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/register/history
 * Returns past register shifts with variances.
 */
async function getHistorySessionsHandler(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 15;
    const sessions = await prisma.registerSession.findMany({
      take: limit,
      orderBy: { created_at: 'desc' },
      include: { opened_by: true },
    });

    return res.status(200).json({
      status: 'success',
      data: sessions,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCurrentSessionHandler,
  openSessionHandler,
  closeSessionHandler,
  getHistorySessionsHandler,
};
