const prisma = require('../prisma');
const { generateMonthlyPayroll } = require('./payroll.service');

function fmt(num) {
  return Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Calculates monthly Cost of Goods Sold (COGS) based on consumable deductions
 * from services billed in the given month.
 */
async function calculateMonthlyCOGS(startOfMonth, endOfMonth) {
  // Query all invoices settled during this month
  const invoices = await prisma.invoice.findMany({
    where: {
      created_at: { gte: startOfMonth, lte: endOfMonth },
    },
    include: {
      job_card: {
        include: {
          services: {
            include: {
              service: {
                include: {
                  service_inventories: {
                    include: { inventory: true },
                  },
                  linked_inventory: true,
                },
              },
            },
          },
        },
      },
    },
  });

  let totalCOGS = 0;
  const itemizedUsage = {};

  for (const inv of invoices) {
    const jobServices = inv.job_card?.services || [];
    for (const item of jobServices) {
      const srv = item.service;
      if (!srv) continue;

      // 1. Relational ServiceInventory mappings
      if (srv.service_inventories && srv.service_inventories.length > 0) {
        for (const mapping of srv.service_inventories) {
          const invItem = mapping.inventory;
          if (invItem) {
            const deduct = parseFloat(mapping.deduction_amount || 0);
            const unitCost = parseFloat(invItem.cost_per_unit || 0);
            const lineCost = deduct * unitCost;
            totalCOGS += lineCost;

            if (!itemizedUsage[invItem.id]) {
              itemizedUsage[invItem.id] = {
                item_name: invItem.item_name,
                unit: invItem.unit_type,
                total_deducted: 0,
                cost_per_unit: unitCost,
                total_cost: 0,
              };
            }
            itemizedUsage[invItem.id].total_deducted += deduct;
            itemizedUsage[invItem.id].total_cost += lineCost;
          }
        }
      } else if (srv.linked_inventory && srv.inventory_deduction_amount) {
        // 2. Legacy linked inventory fallback
        const deduct = parseFloat(srv.inventory_deduction_amount || 0);
        const unitCost = parseFloat(srv.linked_inventory.cost_per_unit || 0);
        const lineCost = deduct * unitCost;
        totalCOGS += lineCost;

        const invId = srv.linked_inventory.id;
        if (!itemizedUsage[invId]) {
          itemizedUsage[invId] = {
            item_name: srv.linked_inventory.item_name,
            unit: srv.linked_inventory.unit_type,
            total_deducted: 0,
            cost_per_unit: unitCost,
            total_cost: 0,
          };
        }
        itemizedUsage[invId].total_deducted += deduct;
        itemizedUsage[invId].total_cost += lineCost;
      }
    }
  }

  return {
    total_cogs: parseFloat(totalCOGS.toFixed(2)),
    consumables_breakdown: Object.values(itemizedUsage),
  };
}

/**
 * Calculates monthly net profit and partner equity dividend distribution:
 * 1. Gross Revenue (from Invoice table)
 * 2. Total Operational Expenses (from Expense table)
 * 3. Total Staff Payroll (Base Salary + Commissions)
 * 4. Cost of Goods Sold (Consumables depleted)
 * 5. Net Distributable Profit
 * 6. Partner Equity Dividend Breakdown
 */
async function calculateMonthlyDividends(monthParam, yearParam) {
  let year, monthIndex;

  if (typeof monthParam === 'string' && monthParam.includes('-')) {
    const [yStr, mStr] = monthParam.split('-');
    year = parseInt(yStr, 10);
    monthIndex = parseInt(mStr, 10) - 1;
  } else {
    monthIndex = parseInt(monthParam, 10) - 1;
    year = parseInt(yearParam, 10) || new Date().getFullYear();
  }

  if (isNaN(year) || isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    const now = new Date();
    year = now.getFullYear();
    monthIndex = now.getMonth();
  }

  const startOfMonth = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

  // 1. Gross Revenue
  const invoices = await prisma.invoice.findMany({
    where: {
      created_at: { gte: startOfMonth, lte: endOfMonth },
    },
  });
  const grossRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0);
  const cashRevenue = invoices
    .filter((inv) => inv.payment_method === 'Cash')
    .reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0);
  const bankRevenue = invoices
    .filter((inv) => inv.payment_method === 'Bank' || inv.payment_method === 'Card')
    .reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0);

  // 2. Operational Expenses
  const expenses = await prisma.expense.findMany({
    where: {
      created_at: { gte: startOfMonth, lte: endOfMonth },
    },
  });
  const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

  // 3. Staff Payroll (Base + Commissions)
  const payrollData = await generateMonthlyPayroll(monthKey);
  const totalPayroll = payrollData.summary.total_payroll_expense;

  // 4. Cost of Goods Sold (COGS)
  const cogsData = await calculateMonthlyCOGS(startOfMonth, endOfMonth);
  const totalCOGS = cogsData.total_cogs;

  // 5. Net Distributable Profit
  const netProfit = parseFloat((grossRevenue - totalExpenses - totalPayroll - totalCOGS).toFixed(2));

  // 6. Partner Equity Split
  const partners = await prisma.partnerEquity.findMany({
    where: { is_active: true },
    orderBy: { equity_percentage: 'desc' },
  });

  const partnerDividends = partners.map((partner) => {
    const percentage = parseFloat(partner.equity_percentage);
    // If netProfit is negative, dividend is 0 or records deficit
    const dividendAmount = netProfit > 0
      ? parseFloat(((netProfit * percentage) / 100).toFixed(2))
      : 0;

    return {
      partner_id: partner.id,
      partner_name: partner.partner_name,
      equity_percentage: percentage,
      phone: partner.phone,
      dividend_amount: dividendAmount,
    };
  });

  const summaryObj = {
    gross_revenue: parseFloat(grossRevenue.toFixed(2)),
    cash_revenue: parseFloat(cashRevenue.toFixed(2)),
    bank_revenue: parseFloat(bankRevenue.toFixed(2)),
    invoices_count: invoices.length,
    total_expenses: parseFloat(totalExpenses.toFixed(2)),
    operating_expenses: parseFloat(totalExpenses.toFixed(2)),
    expenses_count: expenses.length,
    total_payroll: parseFloat(totalPayroll.toFixed(2)),
    staff_payroll: parseFloat(totalPayroll.toFixed(2)),
    staff_count: payrollData.summary.staff_count,
    cogs: totalCOGS,
    consumables_used: cogsData.consumables_breakdown,
    net_profit: netProfit,
    net_distributable_profit: netProfit,
    profit_margin_percent: grossRevenue > 0 ? parseFloat(((netProfit / grossRevenue) * 100).toFixed(2)) : 0,
  };

  return {
    month: monthKey,
    period: {
      from: startOfMonth.toISOString(),
      to: endOfMonth.toISOString(),
    },
    p_and_l: summaryObj,
    summary: summaryObj,
    cogs_breakdown: cogsData.consumables_breakdown.map((c) => ({
      inventory_name: c.item_name,
      unit: c.unit,
      total_units_consumed: c.total_deducted,
      cost_per_unit: c.cost_per_unit,
      total_cogs: c.total_cost,
    })),
    partners: partnerDividends,
  };
}

/**
 * Dispatches monthly dividend and P&L dossier to Telegram partner group via AlertOutbox.
 */
async function dispatchDividendsToTelegram(monthParam, yearParam) {
  const dividendReport = await calculateMonthlyDividends(monthParam, yearParam);
  const pl = dividendReport.p_and_l;

  const lines = [
    `💼 *MONTHLY PROFIT SPLIT & DIVIDEND DOSSIER*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📅 *Fiscal Period:* ${dividendReport.month}`,
    ``,
    `💰 *PROFIT & LOSS STATEMENT*`,
    `• Gross Revenue: *Rs. ${fmt(pl.gross_revenue)}* (${pl.invoices_count} Invoices)`,
    `• Operating Expenses: -Rs. ${fmt(pl.operating_expenses)} (${pl.expenses_count} Vouchers)`,
    `• Staff Payroll: -Rs. ${fmt(pl.staff_payroll)} (${pl.staff_count} Staff)`,
    `• Consumables COGS: -Rs. ${fmt(pl.cogs)}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📈 *NET DISTRIBUTABLE PROFIT:* *${pl.net_profit >= 0 ? '+' : ''}Rs. ${fmt(pl.net_profit)}* (${pl.profit_margin_percent}%)`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `🤝 *PARTNER DIVIDEND DISTRIBUTIONS*`,
  ];

  for (const p of dividendReport.partners) {
    lines.push(`• *${p.partner_name}* (${p.equity_percentage}%): *Rs. ${fmt(p.dividend_amount)}*`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🔒 _Audited Transparent Accounting • Local Server Certified_`);

  const messageText = lines.join('\n');

  // Queue in AlertOutbox
  const outboxItem = await prisma.alertOutbox.create({
    data: {
      type: 'TELEGRAM',
      payload: {
        event: 'MONTHLY_DIVIDENDS',
        month: dividendReport.month,
        message: messageText,
        net_profit: pl.net_profit,
        partners: dividendReport.partners,
      },
      status: 'PENDING',
    },
  });

  return {
    report: dividendReport,
    outbox_id: outboxItem.id,
    message: messageText,
  };
}

module.exports = {
  calculateMonthlyCOGS,
  calculateMonthlyDividends,
  dispatchDividendsToTelegram,
};
