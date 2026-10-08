const prisma = require('../prisma');
const F = require('../services/finance.service');
async function createDepositHandler(req, res, next) {
  try {
    const value = F.amount(req.body.amount),
      requestKey = F.key(req, 'deposit');
    if (!req.body.vehicle_id) throw F.error('Select the customer vehicle for this advance.');
    const {
      method
    } = F.mode(req.body.payment_method);
    const item = await F.transact(async tx => {
      await F.lock(tx, requestKey);
      const previous = await tx.customerDeposit.findUnique({
        where: {
          request_key: requestKey
        }
      });
      if (previous) return previous;
      const vehicle = await tx.vehicle.findUnique({
        where: {
          id: req.body.vehicle_id
        }
      });
      if (!vehicle) throw F.error('Vehicle not found.', 404);
      const deposit = await tx.customerDeposit.create({
        data: {
          vehicle_id: vehicle.id,
          customer_name: req.body.customer_name || vehicle.customer_name || 'Walk-in',
          customer_phone: req.body.customer_phone || vehicle.customer_phone,
          amount: value,
          remaining_amount: value,
          payment_method: method,
          bank_account_id: req.body.bank_account_id || null,
          notes: req.body.notes || null,
          request_key: requestKey
        }
      });
      await F.movement(tx, {
        method,
        bankId: deposit.bank_account_id,
        delta: value,
        kind: 'DEPOSIT',
        sourceId: deposit.id
      });
      await F.audit(tx, req, 'CUSTOMER_DEPOSIT_COLLECTED', 'Vehicle advance recorded.', {
        deposit_id: deposit.id,
        amount: value
      });
      await F.alert(tx, 'Advance received: ' + vehicle.registration_number + ' Rs. ' + value, requestKey);
      return deposit;
    });
    res.status(201).json({
      status: 'success',
      data: item
    });
  } catch (e) {
    next(e);
  }
}
async function listDepositsHandler(req, res, next) {
  try {
    const where = {};
    if (req.query.vehicle_id) where.vehicle_id = req.query.vehicle_id;
    if (req.query.status) where.status = req.query.status;
    res.json({
      status: 'success',
      data: await prisma.customerDeposit.findMany({
        where,
        include: {
          vehicle: true,
          applied_to_invoice: true
        },
        orderBy: {
          created_at: 'desc'
        },
        take: 200
      })
    });
  } catch (e) {
    next(e);
  }
}
async function listActiveDepositsHandler(req, res, next) {
  try {
    if (!req.query.vehicle_id) throw F.error('Select a vehicle to view advances.');
    const data = await prisma.customerDeposit.findMany({
      where: {
        vehicle_id: req.query.vehicle_id,
        status: 'ACTIVE'
      },
      include: {
        vehicle: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });
    res.json({
      status: 'success',
      data: data.map(d => ({
        ...d,
        amount: d.remaining_amount ?? d.amount
      }))
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  createDepositHandler,
  listDepositsHandler,
  listActiveDepositsHandler
};
