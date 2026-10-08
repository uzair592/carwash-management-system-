const prisma = require('../prisma');
const F = require('../services/finance.service');
async function issueMaterialHandler(req, res, next) {
  try {
    const qty = F.amount(req.body.quantity_issued),
      requestKey = F.key(req, 'material');
    const result = await F.transact(async tx => {
      await F.lock(tx, requestKey);
      const previous = await tx.materialIssuance.findUnique({
        where: {
          request_key: requestKey
        },
        include: {
          inventory: true
        }
      });
      if (previous) return previous;
      await F.lock(tx, 'stock:' + req.body.inventory_id);
      const job = await tx.jobCard.findUnique({
        where: {
          id: req.body.job_card_id
        },
        include: {
          invoice: true
        }
      });
      if (!job || job.invoice || !['IN_PROGRESS', 'In_Progress'].includes(job.status)) throw F.error('Issue materials only while workshop work is in progress.');
      const item = await tx.inventory.findUnique({
        where: {
          id: req.body.inventory_id
        }
      });
      if (!item) throw F.error('Inventory item not found.', 404);
      if (F.cents(item.current_stock) < F.cents(qty)) throw F.error('Insufficient stock. Record a verified restock first.');
      const issuance = await tx.materialIssuance.create({
        data: {
          job_card_id: job.id,
          inventory_id: item.id,
          quantity_issued: qty,
          unit_cost: item.cost_per_unit,
          issued_by_id: req.user.id,
          notes: req.body.notes || null,
          request_key: requestKey
        },
        include: {
          inventory: true
        }
      });
      const inventory = await tx.inventory.update({
        where: {
          id: item.id
        },
        data: {
          current_stock: {
            decrement: qty
          }
        }
      });
      await F.audit(tx, req, 'MATERIAL_ISSUED', 'Workshop consumable issued.', {
        issuance_id: issuance.id,
        quantity: qty,
        cost_per_unit: Number(item.cost_per_unit)
      });
      if (Number(inventory.current_stock) <= Number(item.low_stock_threshold)) await F.alert(tx, 'Low stock: ' + item.item_name + ' — ' + inventory.current_stock, requestKey);
      return {
        ...issuance,
        inventory
      };
    });
    res.status(201).json({
      status: 'success',
      data: result,
      inventory: result.inventory
    });
  } catch (e) {
    next(e);
  }
}
async function getJobCardMaterialsHandler(req, res, next) {
  try {
    res.json({
      status: 'success',
      data: await prisma.materialIssuance.findMany({
        where: {
          job_card_id: req.params.id
        },
        include: {
          inventory: true
        },
        orderBy: {
          created_at: 'desc'
        }
      })
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  issueMaterialHandler,
  getJobCardMaterialsHandler
};
