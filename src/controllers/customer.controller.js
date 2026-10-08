const prisma = require('../prisma');

function normalizePlate(plate) {
  if (!plate) return '';
  return String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * GET /api/customers
 * Returns all customer profiles with visit history, total spent, and loyalty tier.
 */
async function listCustomersHandler(req, res, next) {
  try {
    const { search, filter } = req.query;

    const branding = await prisma.businessBranding.findFirst();
    const loyaltyThreshold = branding?.loyalty_threshold || 5;

    let whereClause = {};
    if (search && String(search).trim()) {
      const q = String(search).trim();
      const norm = normalizePlate(q);
      whereClause = {
        OR: [
          { registration_number: { contains: q, mode: 'insensitive' } },
          { normalized_plate: { contains: norm, mode: 'insensitive' } },
          { customer_name: { contains: q, mode: 'insensitive' } },
          { customer_phone: { contains: q } },
        ],
      };
    }

    const vehicles = await prisma.vehicle.findMany({
      where: whereClause,
      include: {
        job_cards: {
          orderBy: { created_at: 'desc' },
          include: {
            invoice: true,
            services: { include: { service: true } },
          },
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    const customers = vehicles.map((v) => {
      const invoices = v.job_cards.map((j) => j.invoice).filter(Boolean);
      const totalSpent = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
      const visits = v.visits || v.job_cards.length || 0;
      const isLoyal = visits >= loyaltyThreshold;
      const lastJob = v.job_cards[0];

      let loyaltyTier = 'NEW';
      if (visits >= loyaltyThreshold * 2) {
        loyaltyTier = 'VIP_PLATINUM';
      } else if (visits >= loyaltyThreshold) {
        loyaltyTier = 'VIP_GOLD';
      } else if (visits > 1) {
        loyaltyTier = 'REGULAR';
      }

      return {
        id: v.id,
        registration_number: v.registration_number,
        normalized_plate: v.normalized_plate,
        make: v.make || 'Other',
        model: v.model || '',
        customer_name: v.customer_name || 'Walk-in Customer',
        customer_phone: v.customer_phone || '',
        visits,
        total_spent: totalSpent,
        is_loyal: isLoyal,
        loyalty_tier: loyaltyTier,
        loyalty_threshold: loyaltyThreshold,
        last_visit: lastJob ? lastJob.created_at : v.updated_at,
        recent_services: lastJob ? lastJob.services.map((s) => s.service?.name || 'Service').filter(Boolean) : [],
      };
    });

    let filtered = customers;
    if (filter === 'LOYAL' || filter === 'VIP') {
      filtered = customers.filter((c) => c.is_loyal);
    } else if (filter === 'REGULAR') {
      filtered = customers.filter((c) => c.visits > 1 && !c.is_loyal);
    } else if (filter === 'NEW') {
      filtered = customers.filter((c) => c.visits <= 1);
    }

    // Sort by visits desc, then total_spent desc
    filtered.sort((a, b) => b.visits - a.visits || b.total_spent - a.total_spent);

    const totalCustomers = customers.length;
    const loyalCount = customers.filter((c) => c.is_loyal).length;
    const repeatCount = customers.filter((c) => c.visits > 1).length;
    const repeatRate = totalCustomers > 0 ? Math.round((repeatCount / totalCustomers) * 100) : 0;
    const totalRevenue = customers.reduce((sum, c) => sum + c.total_spent, 0);

    return res.status(200).json({
      status: 'success',
      data: {
        customers: filtered,
        summary: {
          total_customers: totalCustomers,
          loyal_customers: loyalCount,
          repeat_rate_percent: repeatRate,
          total_lifetime_revenue: totalRevenue,
          loyalty_threshold: loyaltyThreshold,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCustomersHandler,
};
