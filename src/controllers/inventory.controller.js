const prisma = require('../prisma');
const F = require('../services/finance.service');
const {
  UnitType
} = require('@prisma/client');
function validate(data) {
  if (data.unit_type && !Object.values(UnitType).includes(data.unit_type)) throw F.error('Choose a valid inventory unit.');
  for (const k of ['current_stock', 'cost_per_unit', 'low_stock_threshold']) if (data[k] !== undefined) data[k] = F.amount(data[k], {
    zero: true
  });
  return data;
}
async function listInventoryHandler(req, res, next) {
  try {
    const items = await prisma.inventory.findMany({
      orderBy: {
        item_name: 'asc'
      },
      include: {
        services: {
          select: {
            id: true,
            name: true,
            inventory_deduction_amount: true
          }
        }
      }
    });
    res.json({
      status: 'success',
      data: items.map(i => ({
        ...i,
        current_stock: Number(i.current_stock),
        cost_per_unit: req.user.role === 'WORKER' ? undefined : Number(i.cost_per_unit),
        low_stock_threshold: Number(i.low_stock_threshold),
        is_low_stock: Number(i.current_stock) <= Number(i.low_stock_threshold)
      }))
    });
  } catch (e) {
    next(e);
  }
}
async function createInventoryHandler(req, res, next) {
  try {
    const data = validate({
      item_name: String(req.body.item_name || '').trim(),
      unit_type: req.body.unit_type || 'Unit',
      current_stock: req.body.current_stock ?? 0,
      cost_per_unit: req.body.cost_per_unit ?? 0,
      low_stock_threshold: req.body.low_stock_threshold ?? 10
    });
    if (!data.item_name) throw F.error('Item name is required.');
    const result = await F.transact(async tx => {
      const item = await tx.inventory.create({
        data
      });
      await F.audit(tx, req, 'INVENTORY_CREATED', 'Inventory item created.', {
        inventory_id: item.id
      });
      return item;
    });
    res.status(201).json({
      status: 'success',
      data: result
    });
  } catch (e) {
    next(e);
  }
}
async function updateInventoryHandler(req, res, next) {
  try {
    const fields = {};
    for (const k of ['item_name', 'unit_type', 'current_stock', 'cost_per_unit', 'low_stock_threshold']) if (req.body[k] !== undefined) fields[k] = req.body[k];
    validate(fields);
    if (fields.current_stock !== undefined && !String(req.body.reason || '').trim()) throw F.error('A reason is required for a manual stock adjustment.');
    const result = await F.transact(async tx => {
      await F.lock(tx, 'stock:' + req.params.id);
      const original = await tx.inventory.findUnique({
        where: {
          id: req.params.id
        }
      });
      if (!original) throw F.error('Inventory item not found.', 404);
      const updated = await tx.inventory.update({
        where: {
          id: req.params.id
        },
        data: fields
      });
      await F.audit(tx, req, 'INVENTORY_ADJUSTMENT', req.body.reason || 'Inventory details updated.', {
        inventory_id: updated.id,
        previous_stock: Number(original.current_stock),
        new_stock: Number(updated.current_stock)
      });
      return updated;
    });
    res.json({
      status: 'success',
      data: result
    });
  } catch (e) {
    next(e);
  }
}
async function restockInventoryHandler(req, res, next) {
  try {
    const qty = F.amount(req.body.quantity_added),
      requestKey = F.key(req, 'restock');
    const result = await F.transact(async tx => {
      await F.lock(tx, requestKey);
      const previous = await tx.auditLog.findFirst({
        where: {
          action: 'INVENTORY_RESTOCK',
          metadata: {
            path: ['request_key'],
            equals: requestKey
          }
        }
      });
      if (previous) return tx.inventory.findUnique({
        where: {
          id: req.params.id
        }
      });
      await F.lock(tx, 'stock:' + req.params.id);
      const updated = await tx.inventory.update({
        where: {
          id: req.params.id
        },
        data: {
          current_stock: {
            increment: qty
          }
        }
      });
      await F.audit(tx, req, 'INVENTORY_RESTOCK', 'Verified stock received.', {
        inventory_id: updated.id,
        quantity: qty,
        request_key: requestKey
      });
      return updated;
    });
    res.json({
      status: 'success',
      data: result
    });
  } catch (e) {
    next(e);
  }
}
async function linkServiceInventoryHandler(req, res, next) {
  try {
    const qty = req.body.linked_inventory_id ? F.amount(req.body.inventory_deduction_amount) : null;
    const result = await F.transact(async tx => {
      await tx.serviceInventory.deleteMany({
        where: {
          service_id: req.params.id
        }
      });
      if (req.body.linked_inventory_id) await tx.serviceInventory.create({
        data: {
          service_id: req.params.id,
          inventory_id: req.body.linked_inventory_id,
          deduction_amount: qty
        }
      });
      return tx.service.update({
        where: {
          id: req.params.id
        },
        data: {
          linked_inventory_id: req.body.linked_inventory_id || null,
          inventory_deduction_amount: qty
        }
      });
    });
    res.json({
      status: 'success',
      data: result
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  listInventoryHandler,
  createInventoryHandler,
  updateInventoryHandler,
  restockInventoryHandler,
  linkServiceInventoryHandler
};
