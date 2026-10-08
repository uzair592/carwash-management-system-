const prisma = require('../prisma');
const {
  generateMonthlyPayroll
} = require('../services/payroll.service');
const {
  calculateMonthlyDividends,
  dispatchDividendsToTelegram
} = require('../services/equity.service');

/**
 * GET /api/financials/payroll
 */
async function getMonthlyPayrollHandler(req, res, next) {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const payrollData = await generateMonthlyPayroll(month);
    return res.status(200).json({
      status: 'success',
      data: payrollData
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/financials/equity
 */
async function getPartnerEquityHandler(req, res, next) {
  try {
    const partners = await prisma.partnerEquity.findMany({
      where: {
        is_active: true
      },
      orderBy: {
        equity_percentage: 'desc'
      }
    });
    return res.status(200).json({
      status: 'success',
      data: partners
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/financials/equity
 */
async function upsertPartnerEquityHandler(req, res, next) {
  try {
    const {
      id,
      partner_name,
      equity_percentage,
      phone
    } = req.body;
    if (!partner_name || equity_percentage === undefined || isNaN(equity_percentage)) {
      return res.status(400).json({
        status: 'error',
        message: 'Partner name and equity percentage are required.'
      });
    }
    if (Number(equity_percentage) <= 0 || Number(equity_percentage) > 100) return res.status(400).json({
      status: 'error',
      message: 'Equity must be greater than zero and at most 100%.'
    });
    let partner;
    if (id) {
      partner = await prisma.partnerEquity.update({
        where: {
          id
        },
        data: {
          partner_name: String(partner_name).trim(),
          equity_percentage: parseFloat(equity_percentage),
          phone: phone || null
        }
      });
    } else {
      partner = await prisma.partnerEquity.create({
        data: {
          partner_name: String(partner_name).trim(),
          equity_percentage: parseFloat(equity_percentage),
          phone: phone || null
        }
      });
    }
    return res.status(200).json({
      status: 'success',
      message: 'Partner equity saved successfully.',
      data: partner
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/financials/dividends
 */
async function getMonthlyDividendsHandler(req, res, next) {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const dividendData = await calculateMonthlyDividends(month);
    return res.status(200).json({
      status: 'success',
      data: dividendData
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/financials/dividends/dispatch
 */
async function dispatchDividendsHandler(req, res, next) {
  try {
    const {
      month
    } = req.body;
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const result = await dispatchDividendsToTelegram(targetMonth);
    return res.status(200).json({
      status: 'success',
      message: `Monthly dividend dossier for ${targetMonth} queued for Telegram partner group.`,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/inventory/yield-mappings
 */
async function listYieldMappingsHandler(req, res, next) {
  try {
    const mappings = await prisma.serviceInventory.findMany({
      include: {
        service: true,
        inventory: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });
    return res.status(200).json({
      status: 'success',
      data: mappings
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/inventory/yield-mappings
 */
async function createYieldMappingHandler(req, res, next) {
  try {
    const {
      service_id,
      inventory_id,
      deduction_amount
    } = req.body;
    if (!service_id || !inventory_id || !deduction_amount) {
      return res.status(400).json({
        status: 'error',
        message: 'service_id, inventory_id, and deduction_amount are required.'
      });
    }
    const mapping = await prisma.serviceInventory.upsert({
      where: {
        service_id_inventory_id: {
          service_id,
          inventory_id
        }
      },
      update: {
        deduction_amount: parseFloat(deduction_amount)
      },
      create: {
        service_id,
        inventory_id,
        deduction_amount: parseFloat(deduction_amount)
      },
      include: {
        service: true,
        inventory: true
      }
    });
    return res.status(200).json({
      status: 'success',
      message: 'Service inventory deduction mapped successfully.',
      data: mapping
    });
  } catch (error) {
    next(error);
  }
}
module.exports = {
  getMonthlyPayrollHandler,
  getPartnerEquityHandler,
  upsertPartnerEquityHandler,
  getMonthlyDividendsHandler,
  dispatchDividendsHandler,
  listYieldMappingsHandler,
  createYieldMappingHandler
};
