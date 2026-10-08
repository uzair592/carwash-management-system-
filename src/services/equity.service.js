const prisma = require('../prisma');
const {
  generateMonthlyPayroll
} = require('./payroll.service');
function fmt(num) {
  return Number(num || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Calculates monthly Cost of Goods Sold (COGS).
 * Enterprise ERP: Primarily queries MaterialIssuance created in this month.
 * Falls back to invoice-service yield mappings for legacy records.
 */
async function calculateMonthlyCOGS(startOfMonth, endOfMonth) {
  const invoices = await prisma.invoice.findMany({
    where: {
      created_at: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    },
    include: {
      job_card: {
        include: {
          material_issuances: {
            include: {
              inventory: true
            }
          },
          services: {
            include: {
              service: {
                include: {
                  service_inventories: {
                    include: {
                      inventory: true
                    }
                  },
                  linked_inventory: true
                }
              }
            }
          }
        }
      }
    }
  });
  let total = 0;
  const usage = new Map();
  for (const invoice of invoices) {
    const job = invoice.job_card;
    const items = job.material_issuances.length ? job.material_issuances.map(i => ({
      inventory: i.inventory,
      quantity: Number(i.quantity_issued),
      cost: Number(i.unit_cost ?? i.inventory.cost_per_unit)
    })) : job.services.flatMap(s => s.service.service_inventories.map(m => ({
      inventory: m.inventory,
      quantity: Number(m.deduction_amount),
      cost: Number(m.inventory.cost_per_unit)
    })));
    for (const item of items) {
      const line = item.quantity * item.cost;
      total += line;
      const row = usage.get(item.inventory.id) || {
        item_name: item.inventory.item_name,
        unit: item.inventory.unit_type,
        total_deducted: 0,
        cost_per_unit: item.cost,
        total_cost: 0
      };
      row.total_deducted += item.quantity;
      row.total_cost += line;
      usage.set(item.inventory.id, row);
    }
  }
  return {
    total_cogs: Math.round(total * 100) / 100,
    consumables_breakdown: [...usage.values()]
  };
}

/**
 * Calculates monthly net profit and partner equity dividend distribution:
 * 1. Gross Revenue (from Invoice table)
 * 2. Total Operational Expenses (from Expense table - excludes partner drawings)
 * 3. Total Staff Payroll (Base Salary + Commissions)
 * 4. Cost of Goods Sold (Consumables depleted via MaterialIssuance)
 * 5. Net Distributable Profit
 * 6. Partner Equity Dividend Breakdown (less monthly Drawings)
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
  const {
    start: startOfMonth,
    end: endOfMonth
  } = require('../utils/business-time').monthBounds(`${year}-${String(monthIndex + 1).padStart(2, '0')}`);
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

  // 1. Gross Revenue
  const invoices = await prisma.invoice.findMany({
    where: {
      created_at: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    }
  });
  const grossRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0);
  const collections = await prisma.payment.findMany({
    where: {
      created_at: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    }
  });
  const cashRevenue = collections.filter(p => p.payment_method === 'Cash').reduce((sum, p) => sum + Number(p.amount), 0);
  const bankRevenue = collections.filter(p => ['Bank', 'Card'].includes(p.payment_method)).reduce((sum, p) => sum + Number(p.amount), 0);

  // 2. Operational Expenses (pure business expenses, partner drawings are excluded)
  const expenses = await prisma.expense.findMany({
    where: {
      created_at: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    }
  });
  const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

  // 3. Staff Payroll (Base + Commissions)
  const payrollData = await generateMonthlyPayroll(monthKey);
  const totalPayroll = payrollData.summary.total_payroll_expense;

  // 4. Cost of Goods Sold (COGS)
  const cogsData = await calculateMonthlyCOGS(startOfMonth, endOfMonth);
  const totalCOGS = cogsData.total_cogs;

  // 5. Net Distributable Profit
  const refunds = await prisma.refund.findMany({
    where: {
      created_at: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    }
  });
  const totalRefunds = refunds.reduce((s, r) => s + Number(r.amount), 0);
  const netProfit = parseFloat((grossRevenue - totalRefunds - totalExpenses - totalPayroll - totalCOGS).toFixed(2));

  // 6. Query Partner Drawings for this month
  const monthlyDrawings = await prisma.partnerTransaction.findMany({
    where: {
      type: 'DRAWING',
      date: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    }
  });

  // 7. Partner Equity Split & Drawings Offset
  const partners = await prisma.partnerEquity.findMany({
    where: {
      is_active: true
    },
    orderBy: {
      equity_percentage: 'desc'
    }
  });
  if (partners.length && Math.abs(partners.reduce((s, p) => s + Number(p.equity_percentage), 0) - 100) > 0.001) throw Object.assign(new Error('Active partner equity must total 100% before distributing profit.'), {
    status: 409
  });
  const partnerDividends = partners.map(partner => {
    const percentage = parseFloat(partner.equity_percentage);
    const dividendAmount = netProfit > 0 ? parseFloat((netProfit * percentage / 100).toFixed(2)) : 0;
    const partnerDrawings = monthlyDrawings.filter(d => d.partner_id === partner.id).reduce((sum, d) => sum + parseFloat(d.amount), 0);
    const netPayout = Math.max(0, parseFloat((dividendAmount - partnerDrawings).toFixed(2)));
    return {
      id: partner.id,
      partner_id: partner.id,
      partner_name: partner.partner_name,
      equity_percentage: percentage,
      phone: partner.phone,
      dividend_amount: dividendAmount,
      drawings_amount: partnerDrawings,
      net_payout: netPayout
    };
  });
  const totalDrawingsAllPartners = monthlyDrawings.reduce((sum, d) => sum + parseFloat(d.amount), 0);
  const summaryObj = {
    gross_revenue: parseFloat(grossRevenue.toFixed(2)),
    total_refunds: totalRefunds,
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
    profit_margin_percent: grossRevenue > 0 ? parseFloat((netProfit / grossRevenue * 100).toFixed(2)) : 0,
    total_drawings: totalDrawingsAllPartners
  };
  return {
    month: monthKey,
    period: {
      from: startOfMonth.toISOString(),
      to: endOfMonth.toISOString()
    },
    p_and_l: summaryObj,
    summary: summaryObj,
    cogs_breakdown: cogsData.consumables_breakdown.map(c => ({
      inventory_name: c.item_name,
      unit: c.unit,
      total_units_consumed: c.total_deducted,
      cost_per_unit: c.cost_per_unit,
      total_cogs: c.total_cost
    })),
    partners: partnerDividends
  };
}

/**
 * Dispatches monthly dividend and P&L dossier to Telegram partner group via AlertOutbox.
 */
async function dispatchDividendsToTelegram(monthParam, yearParam) {
  const dividendReport = await calculateMonthlyDividends(monthParam, yearParam);
  const pl = dividendReport.p_and_l;
  const lines = [`💼 *MONTHLY PROFIT SPLIT & DIVIDEND DOSSIER*`, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`, `📅 *Fiscal Period:* ${dividendReport.month}`, ``, `💰 *PROFIT & LOSS STATEMENT*`, `• Gross Revenue: *Rs. ${fmt(pl.gross_revenue)}* (${pl.invoices_count} Invoices)`, `• Operating Expenses: -Rs. ${fmt(pl.operating_expenses)} (${pl.expenses_count} Vouchers)`, `• Staff Payroll: -Rs. ${fmt(pl.staff_payroll)} (${pl.staff_count} Staff)`, `• Consumables COGS: -Rs. ${fmt(pl.cogs)}`, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`, `📈 *NET DISTRIBUTABLE PROFIT:* *${pl.net_profit >= 0 ? '+' : ''}Rs. ${fmt(pl.net_profit)}* (${pl.profit_margin_percent}%)`, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`, ``, `🤝 *PARTNER DIVIDEND DISTRIBUTIONS*`];
  for (const p of dividendReport.partners) {
    if (p.drawings_amount > 0) {
      lines.push(`• *${p.partner_name}* (${p.equity_percentage}%): Gross Rs. ${fmt(p.dividend_amount)} - Drawings Rs. ${fmt(p.drawings_amount)} = *Net Rs. ${fmt(p.net_payout)}*`);
    } else {
      lines.push(`• *${p.partner_name}* (${p.equity_percentage}%): *Rs. ${fmt(p.dividend_amount)}*`);
    }
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
        partners: dividendReport.partners
      },
      status: 'PENDING'
    }
  });
  return {
    report: dividendReport,
    outbox_id: outboxItem.id,
    message: messageText
  };
}
module.exports = {
  calculateMonthlyCOGS,
  calculateMonthlyDividends,
  dispatchDividendsToTelegram
};
