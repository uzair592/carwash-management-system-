const prisma = require('../prisma');
const F = require('../services/finance.service');
const normalize = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const limits = {
  customer_name: 100,
  customer_phone: 25,
  make: 50,
  model: 50
};
function profile(body) {
  const result = {};
  for (const [key, max] of Object.entries(limits)) if (body[key] !== undefined) {
    if (body[key] !== null && typeof body[key] !== 'string') throw F.error('Enter valid customer details.');
    const value = String(body[key] || '').trim();
    if (value.length > max) throw F.error(`${key.replace(/_/g, ' ')} is too long.`);
    result[key] = value || null;
  }
  return result;
}
async function saveCustomer(req, res, next) {
  try {
    const fields = profile(req.body);
    const result = await F.transact(async tx => {
      if (req.params.id) {
        await F.lock(tx, 'customer:' + req.params.id);
        const existing = await tx.vehicle.findUnique({
          where: {
            id: req.params.id
          }
        });
        if (!existing) throw F.error('Customer vehicle not found.', 404);
        if (req.body.registration_number !== undefined && normalize(req.body.registration_number) !== normalize(existing.registration_number)) throw F.error('Vehicle plates cannot be changed here. Create the correct vehicle to preserve ticket history.');
        const value = await tx.vehicle.update({
          where: {
            id: existing.id
          },
          data: fields
        });
        await F.audit(tx, req, 'CUSTOMER_UPDATED', 'Customer profile updated.', {
          vehicle_id: value.id
        });
        return value;
      }
      const plate = String(req.body.registration_number || '').trim().toUpperCase();
      const normalized = normalize(plate);
      if (!normalized || plate.length > 30) throw F.error('Enter a valid vehicle plate (up to 30 characters).');
      await F.lock(tx, 'plate:' + normalized);
      if ((await tx.vehicle.findFirst({
        where: {
          normalized_plate: normalized
        }
      })) || (await tx.vehicle.findFirst({
        where: {
          registration_number: plate
        }
      }))) throw F.error('This vehicle already exists. Edit its customer details instead.', 409);
      const value = await tx.vehicle.create({
        data: {
          registration_number: plate,
          normalized_plate: normalized,
          ...fields
        }
      });
      await F.audit(tx, req, 'CUSTOMER_CREATED', 'Customer vehicle registered.', {
        vehicle_id: value.id
      });
      return value;
    });
    res.status(req.params.id ? 200 : 201).json({
      status: 'success',
      data: result
    });
  } catch (e) {
    next(e);
  }
}
async function deleteCustomer(req, res, next) {
  try {
    await F.transact(async tx => {
      await F.lock(tx, 'customer:' + req.params.id);
      const value = await tx.vehicle.findUnique({
        where: {
          id: req.params.id
        }
      });
      if (!value) throw F.error('Customer vehicle not found.', 404);
      if ((await tx.jobCard.count({
        where: {
          vehicle_id: value.id
        }
      })) || (await tx.customerDeposit.count({
        where: {
          vehicle_id: value.id
        }
      }))) throw F.error('This vehicle has tickets or advances. Its history must be retained; you can edit its contact details.', 409);
      await tx.vehicle.delete({
        where: {
          id: value.id
        }
      });
      await F.audit(tx, req, 'CUSTOMER_DELETED', 'Unused customer vehicle removed.', {
        vehicle_id: value.id,
        plate: value.registration_number
      });
    });
    res.json({
      status: 'success'
    });
  } catch (e) {
    next(e);
  }
}
async function deleteInventory(req, res, next) {
  try {
    await F.transact(async tx => {
      await F.lock(tx, 'stock:' + req.params.id);
      const value = await tx.inventory.findUnique({
        where: {
          id: req.params.id
        }
      });
      if (!value) throw F.error('Inventory item not found.', 404);
      if (Number(value.current_stock) !== 0 || (await tx.service.count({
        where: {
          linked_inventory_id: value.id
        }
      })) || (await tx.serviceInventory.count({
        where: {
          inventory_id: value.id
        }
      })) || (await tx.materialIssuance.count({
        where: {
          inventory_id: value.id
        }
      }))) throw F.error('Only empty, unused inventory items can be deleted. Stock, service mappings and material history must be retained.', 409);
      await tx.inventory.delete({
        where: {
          id: value.id
        }
      });
      await F.audit(tx, req, 'INVENTORY_DELETED', 'Empty unused inventory item removed.', {
        inventory_id: value.id,
        name: value.item_name
      });
    });
    res.json({
      status: 'success'
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  saveCustomer,
  deleteCustomer,
  deleteInventory
};
