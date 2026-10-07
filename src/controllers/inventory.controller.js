const prisma = require('../prisma');

/**
 * GET /api/inventory
 * Lists all inventory consumable items with stock levels, costs, and thresholds
 */
async function listInventoryHandler(req, res, next) {
  try {
    const items = await prisma.inventory.findMany({
      orderBy: { item_name: 'asc' },
      include: {
        services: {
          select: {
            id: true,
            name: true,
            inventory_deduction_amount: true,
          },
        },
      },
    });

    const formatted = items.map((item) => {
      const currentStock = parseFloat(item.current_stock);
      const threshold = parseFloat(item.low_stock_threshold);
      return {
        ...item,
        current_stock: currentStock,
        cost_per_unit: parseFloat(item.cost_per_unit),
        low_stock_threshold: threshold,
        is_low_stock: currentStock <= threshold,
      };
    });

    return res.status(200).json({
      status: 'success',
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/inventory
 * Create a new consumable inventory item
 */
async function createInventoryHandler(req, res, next) {
  try {
    const { item_name, unit_type = 'Unit', current_stock = 0, cost_per_unit = 0, low_stock_threshold = 10 } = req.body;

    if (!item_name) {
      return res.status(400).json({ status: 'error', message: 'Item name is required.' });
    }

    const created = await prisma.inventory.create({
      data: {
        item_name,
        unit_type,
        current_stock: parseFloat(current_stock) || 0,
        cost_per_unit: parseFloat(cost_per_unit) || 0,
        low_stock_threshold: parseFloat(low_stock_threshold) || 10,
      },
    });

    return res.status(201).json({
      status: 'success',
      message: `Inventory item "${created.item_name}" created successfully.`,
      data: created,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/inventory/:id
 * Updates an inventory item (stock count, thresholds, cost)
 */
async function updateInventoryHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { item_name, unit_type, current_stock, cost_per_unit, low_stock_threshold } = req.body;

    const data = {};
    if (item_name !== undefined) data.item_name = item_name;
    if (unit_type !== undefined) data.unit_type = unit_type;
    if (current_stock !== undefined) data.current_stock = parseFloat(current_stock);
    if (cost_per_unit !== undefined) data.cost_per_unit = parseFloat(cost_per_unit);
    if (low_stock_threshold !== undefined) data.low_stock_threshold = parseFloat(low_stock_threshold);

    const updated = await prisma.inventory.update({
      where: { id },
      data,
    });

    return res.status(200).json({
      status: 'success',
      message: `Inventory item "${updated.item_name}" updated successfully.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/inventory/:id/restock
 * Restocks quantity when a new shipment arrives
 */
async function restockInventoryHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { quantity_added } = req.body;

    const qty = parseFloat(quantity_added);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid positive quantity_added number is required.',
      });
    }

    const item = await prisma.inventory.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ status: 'error', message: 'Inventory item not found.' });
    }

    const currentStock = parseFloat(item.current_stock);
    const newStock = parseFloat((currentStock + qty).toFixed(2));

    const updated = await prisma.inventory.update({
      where: { id },
      data: {
        current_stock: newStock,
        updated_at: new Date(),
      },
    });

    return res.status(200).json({
      status: 'success',
      message: `Restocked ${qty} ${updated.unit_type} of ${updated.item_name}. New stock: ${newStock} ${updated.unit_type}.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/services/:id/link-inventory
 * Links a service to an inventory consumable with deduction quantity
 */
async function linkServiceInventoryHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { linked_inventory_id, inventory_deduction_amount } = req.body;

    const data = {
      linked_inventory_id: linked_inventory_id || null,
      inventory_deduction_amount: inventory_deduction_amount !== null && inventory_deduction_amount !== undefined
        ? parseFloat(inventory_deduction_amount)
        : null,
    };

    const updated = await prisma.service.update({
      where: { id },
      data,
      include: {
        linked_inventory: true,
      },
    });

    return res.status(200).json({
      status: 'success',
      message: `Service "${updated.name}" inventory yield link updated.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listInventoryHandler,
  createInventoryHandler,
  updateInventoryHandler,
  restockInventoryHandler,
  linkServiceInventoryHandler,
};
