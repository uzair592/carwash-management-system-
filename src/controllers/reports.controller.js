const prisma = require('../prisma');
const {
  rangeDates,
  dayKey
} = require('../utils/business-time');
const F = require('../services/finance.service');
async function getReportsSummaryHandler(req, res, next) {
  try {
    const {
      start,
      end
    } = rangeDates(req.query);
    const date = {
      gte: start,
      lte: end
    };
    const [invoices, payments, expenses, refunds, deposits] = await Promise.all([prisma.invoice.findMany({
      where: {
        created_at: date
      },
      include: {
        cashier: {
          select: {
            id: true,
            name: true
          }
        },
        job_card: {
          include: {
            vehicle: true,
            services: {
              include: {
                service: true
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    }), prisma.payment.findMany({
      where: {
        created_at: date
      }
    }), prisma.expense.findMany({
      where: {
        created_at: date
      }
    }), prisma.refund.findMany({
      where: {
        created_at: date
      }
    }), prisma.customerDeposit.findMany({
      where: {
        created_at: date
      }
    })]);
    const sum = (rows, k = 'amount') => rows.reduce((s, i) => s + F.cents(i[k]), 0) / 100;
    const gross = sum(invoices, 'total_amount'),
      cash = sum(payments.filter(p => p.payment_method === 'Cash')),
      bank = sum(payments.filter(p => p.payment_method !== 'Cash'));
    const top = new Map(),
      makes = new Map(),
      days = new Map();
    for (const inv of invoices) {
      const items = inv.line_snapshot || inv.job_card?.services || [];
      for (const item of items) {
        const name = item.name || item.service?.name || 'Service',
          v = top.get(name) || {
            name,
            count: 0,
            revenue: 0,
            category: item.category || item.service?.category
          };
        v.count++;
        v.revenue += Number(item.price_charged);
        top.set(name, v);
      }
      const make = inv.job_card?.vehicle?.make || 'Other';
      makes.set(make, (makes.get(make) || 0) + 1);
      const k = dayKey(inv.created_at),
        day = days.get(k) || {
          date: k,
          revenue: 0,
          invoices: 0,
          cash: 0,
          bank: 0
        };
      day.revenue += Number(inv.total_amount);
      day.invoices++;
      days.set(k, day);
    }
    for (const p of payments) {
      const k = dayKey(p.created_at),
        day = days.get(k) || {
          date: k,
          revenue: 0,
          invoices: 0,
          cash: 0,
          bank: 0
        };
      day[p.payment_method === 'Cash' ? 'cash' : 'bank'] += Number(p.amount);
      days.set(k, day);
    }
    const credits = sum(refunds),
      out = sum(expenses),
      collections = cash + bank;
    const outstanding = await prisma.invoice.aggregate({
      _sum: {
        balance_due: true
      }
    });
    res.json({
      status: 'success',
      data: {
        filter: {
          range: req.query.range || 'month',
          start_date: start.toISOString(),
          end_date: end.toISOString()
        },
        summary: {
          gross_revenue: gross,
          total_discounts: sum(invoices, 'discount_amount'),
          net_paid_revenue: collections,
          total_expenses: out,
          net_operating_profit: null,
          net_sales: gross - credits,
          total_refunds: credits,
          net_cash_flow: collections + sum(deposits) - out - credits,
          outstanding_balance: Number(outstanding._sum.balance_due || 0),
          advance_collected: sum(deposits),
          total_invoices: invoices.length,
          average_ticket: invoices.length ? gross / invoices.length : 0,
          cash_revenue: cash,
          bank_revenue: bank,
          cash_invoices_count: new Set(payments.filter(p => p.payment_method === 'Cash').map(p => p.invoice_id)).size,
          bank_invoices_count: new Set(payments.filter(p => p.payment_method !== 'Cash').map(p => p.invoice_id)).size
        },
        top_services: [...top.values()].sort((a, b) => b.revenue - a.revenue),
        top_makes: [...makes].map(([make, count]) => ({
          make,
          count
        })),
        timeline: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
        recent_invoices: invoices.slice(0, 25).map(i => ({
          id: i.id,
          invoice_number: i.invoice_number,
          date: i.created_at,
          plate: i.job_card?.vehicle?.registration_number,
          customer: i.job_card?.customer_name,
          payment_method: i.payment_method,
          total_amount: Number(i.total_amount),
          cashier_name: i.cashier?.name || 'Cashier'
        }))
      }
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  getReportsSummaryHandler
};
