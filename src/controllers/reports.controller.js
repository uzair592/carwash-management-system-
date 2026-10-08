const prisma = require('../prisma');

/**
 * GET /api/reports/summary
 * Returns comprehensive sales, cashflow, services, and operations reports.
 */
async function getReportsSummaryHandler(req, res, next) {
  try {
    const { range = 'month', from, to } = req.query;

    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (range === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (range === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      endDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
    } else if (range === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      startDate = new Date(d.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
    } else if (range === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (range === 'last_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (range === 'all') {
      startDate = new Date(2020, 0, 1);
      endDate = new Date(2100, 0, 1);
    } else if (range === 'custom' && from) {
      startDate = new Date(from);
      endDate = to ? new Date(to) : new Date();
    } else {
      // Default: current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // 1. Fetch Invoices in Date Range
    const invoices = await prisma.invoice.findMany({
      where: {
        created_at: { gte: startDate, lte: endDate },
      },
      include: {
        cashier: { select: { id: true, name: true } },
        job_card: {
          include: {
            vehicle: true,
            services: { include: { service: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // 2. Fetch Expenses in Date Range
    const expenses = await prisma.expense.findMany({
      where: {
        created_at: { gte: startDate, lte: endDate },
      },
      orderBy: { created_at: 'desc' },
    });

    // Calculations
    const grossRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
    const totalDiscounts = invoices.reduce((sum, inv) => sum + parseFloat(inv.discount_amount || 0), 0);
    const netPaidRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || inv.total_amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);

    const cashInvoices = invoices.filter((i) => i.payment_method === 'Cash');
    const bankInvoices = invoices.filter((i) => i.payment_method === 'Bank' || i.payment_method === 'Card');

    const cashRevenue = cashInvoices.reduce((sum, i) => sum + parseFloat(i.paid_amount || i.total_amount || 0), 0);
    const bankRevenue = bankInvoices.reduce((sum, i) => sum + parseFloat(i.paid_amount || i.total_amount || 0), 0);

    const totalInvoicesCount = invoices.length;
    const avgTicketValue = totalInvoicesCount > 0 ? Math.round(grossRevenue / totalInvoicesCount) : 0;

    // Service Breakdown
    const serviceCounts = {};
    for (const inv of invoices) {
      const services = inv.job_card?.services || [];
      for (const item of services) {
        const sName = item.service?.name || 'Standard Service';
        const price = parseFloat(item.price_charged || item.service?.price || 0);
        if (!serviceCounts[sName]) {
          serviceCounts[sName] = { name: sName, count: 0, revenue: 0, category: item.service?.category || 'Wash' };
        }
        serviceCounts[sName].count += 1;
        serviceCounts[sName].revenue += price;
      }
    }
    const topServices = Object.values(serviceCounts).sort((a, b) => b.revenue - a.revenue);

    // Vehicle Makes Breakdown
    const makeCounts = {};
    for (const inv of invoices) {
      const make = inv.job_card?.vehicle?.make || 'Other';
      if (!makeCounts[make]) makeCounts[make] = { make, count: 0 };
      makeCounts[make].count += 1;
    }
    const topMakes = Object.values(makeCounts).sort((a, b) => b.count - a.count);

    // Daily Timeline
    const dailyMap = {};
    for (const inv of invoices) {
      const dayKey = new Date(inv.created_at).toISOString().slice(0, 10);
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { date: dayKey, revenue: 0, invoices: 0, cash: 0, bank: 0 };
      }
      const paid = parseFloat(inv.paid_amount || inv.total_amount || 0);
      dailyMap[dayKey].revenue += paid;
      dailyMap[dayKey].invoices += 1;
      if (inv.payment_method === 'Cash') dailyMap[dayKey].cash += paid;
      else dailyMap[dayKey].bank += paid;
    }
    const timeline = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    return res.status(200).json({
      status: 'success',
      data: {
        filter: {
          range,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        },
        summary: {
          gross_revenue: grossRevenue,
          total_discounts: totalDiscounts,
          net_paid_revenue: netPaidRevenue,
          total_expenses: totalExpenses,
          net_operating_profit: netPaidRevenue - totalExpenses,
          total_invoices: totalInvoicesCount,
          average_ticket: avgTicketValue,
          cash_revenue: cashRevenue,
          cash_invoices_count: cashInvoices.length,
          bank_revenue: bankRevenue,
          bank_invoices_count: bankInvoices.length,
        },
        top_services: topServices,
        top_makes: topMakes,
        timeline,
        recent_invoices: invoices.slice(0, 25).map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          date: inv.created_at,
          plate: inv.job_card?.vehicle?.registration_number || 'N/A',
          customer: inv.job_card?.customer_name || 'Walk-in',
          payment_method: inv.payment_method,
          total_amount: parseFloat(inv.total_amount || 0),
          cashier_name: inv.cashier?.name || 'Cashier',
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getReportsSummaryHandler,
};
