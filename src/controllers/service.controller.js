const prisma = require('../prisma');

/**
 * GET /api/services
 * Returns all services (active by default, or all if include_inactive=true)
 */
async function listServicesHandler(req, res, next) {
  try {
    const {
      include_inactive,
      category
    } = req.query;
    const where = {};
    if (include_inactive !== 'true') {
      where.is_active = true;
    }
    if (category) {
      where.category = category;
    }
    const services = await prisma.service.findMany({
      where,
      orderBy: [{
        category: 'asc'
      }, {
        name: 'asc'
      }],
      include: {
        linked_inventory: true,
        service_inventories: {
          include: {
            inventory: true
          }
        }
      }
    });
    return res.status(200).json({
      status: 'success',
      count: services.length,
      data: services
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/services
 * Add a new service (Admin/Manager only)
 */
async function createServiceHandler(req, res, next) {
  try {
    const {
      name,
      category = 'Wash',
      price,
      estimated_time = 30,
      linked_inventory_id,
      inventory_deduction_amount
    } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'Service "name" and "price" are required.'
      });
    }
    const priceNum = require('../services/finance.service').amount(price, {
      zero: true
    });
    const durationNum = Math.max(5, parseInt(estimated_time, 10) || 30);
    const newService = await require('../services/finance.service').transact(async tx => {
      const newService = await tx.service.create({
        data: {
          name: String(name).trim(),
          category: category || 'Wash',
          price: priceNum,
          estimated_time: durationNum,
          is_active: true,
          linked_inventory_id: linked_inventory_id || null,
          inventory_deduction_amount: inventory_deduction_amount ? require('../services/finance.service').amount(inventory_deduction_amount) : null
        },
        include: {
          linked_inventory: true
        }
      });

      // If linked inventory specified with deduction amount, also register in service_inventory mapping
      if (linked_inventory_id && inventory_deduction_amount) {
        await tx.serviceInventory.upsert({
          where: {
            service_id_inventory_id: {
              service_id: newService.id,
              inventory_id: linked_inventory_id
            }
          },
          create: {
            service_id: newService.id,
            inventory_id: linked_inventory_id,
            deduction_amount: parseFloat(inventory_deduction_amount)
          },
          update: {
            deduction_amount: parseFloat(inventory_deduction_amount)
          }
        });
      }
      await tx.auditLog.create({
        data: {
          action: 'SERVICE_CREATED',
          description: `Service "${newService.name}" (${newService.category}) created with price Rs. ${priceNum.toLocaleString()} and duration ${durationNum} min.`,
          performed_by_user_id: req.user?.id || null,
          performed_by_name: req.user?.name || 'Shop Admin',
          metadata: {
            service_id: newService.id,
            price: priceNum,
            category: newService.category
          }
        }
      });
      return newService;
    });
    return res.status(201).json({
      status: 'success',
      message: `Service "${newService.name}" added successfully.`,
      data: newService
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/services/:id
 * Edit service name, price, category, duration, consumables, and active status
 * Note: Price changes only apply to future selections.
 */
async function updateServiceHandler(req, res, next) {
  try {
    const {
      id
    } = req.params;
    const {
      name,
      category,
      price,
      estimated_time,
      is_active,
      linked_inventory_id,
      inventory_deduction_amount
    } = req.body;
    const existing = await prisma.service.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Service not found.'
      });
    }
    const priceChanged = price !== undefined && parseFloat(price) !== parseFloat(existing.price);
    const updated = await require('../services/finance.service').transact(async tx => {
      const updated = await tx.service.update({
        where: {
          id
        },
        data: {
          name: name ? String(name).trim() : undefined,
          category: category !== undefined ? category : undefined,
          price: price !== undefined ? require('../services/finance.service').amount(price, {
            zero: true
          }) : undefined,
          estimated_time: estimated_time !== undefined ? parseInt(estimated_time, 10) : undefined,
          is_active: is_active !== undefined ? Boolean(is_active) : undefined,
          linked_inventory_id: linked_inventory_id !== undefined ? linked_inventory_id || null : undefined,
          inventory_deduction_amount: inventory_deduction_amount !== undefined ? inventory_deduction_amount ? require('../services/finance.service').amount(inventory_deduction_amount) : null : undefined
        },
        include: {
          linked_inventory: true
        }
      });
      if (linked_inventory_id !== undefined) await tx.serviceInventory.deleteMany({
        where: {
          service_id: id
        }
      });
      // Update consumable mapping if provided
      if (linked_inventory_id && inventory_deduction_amount) {
        await tx.serviceInventory.upsert({
          where: {
            service_id_inventory_id: {
              service_id: id,
              inventory_id: linked_inventory_id
            }
          },
          create: {
            service_id: id,
            inventory_id: linked_inventory_id,
            deduction_amount: parseFloat(inventory_deduction_amount)
          },
          update: {
            deduction_amount: parseFloat(inventory_deduction_amount)
          }
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'SERVICE_UPDATED',
          description: `Service "${updated.name}" updated by ${req.user?.name || 'Admin'}.${priceChanged ? ` Price changed from Rs. ${parseFloat(existing.price).toLocaleString()} to Rs. ${parseFloat(updated.price).toLocaleString()}. (Applies to future jobs).` : ''}`,
          performed_by_user_id: req.user?.id || null,
          performed_by_name: req.user?.name || 'Shop Admin',
          metadata: {
            service_id: id,
            old_price: parseFloat(existing.price),
            new_price: parseFloat(updated.price),
            changes: req.body
          }
        }
      });
      return updated;
    });
    return res.status(200).json({
      status: 'success',
      message: 'Service updated successfully.',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/job-cards/:jobCardId/services/:serviceId/price-override
 * Authorised price override on an existing job card (recorded in Audit Log)
 */
async function overrideJobCardServicePriceHandler(req, res, next) {
  try {
    const F = require('../services/finance.service');
    const approval = await require('../services/permission.service').approval(req, 'billing.discount');
    if (!approval.isValid || !String(req.body.reason || '').trim()) throw F.error('Admin PIN and reason required.', 403);
    const value = F.amount(req.body.override_price, {
      zero: true
    });
    const result = await F.transact(async tx => {
      await F.lock(tx, 'checkout:' + req.params.jobCardId);
      const job = await tx.jobCard.findUnique({
        where: {
          id: req.params.jobCardId
        },
        include: {
          invoice: true
        }
      });
      if (!job || job.invoice) throw F.error('Only uninvoiced jobs can be changed.', 409);
      const item = await tx.jobCardService.update({
        where: {
          job_card_id_service_id: {
            job_card_id: job.id,
            service_id: req.params.serviceId
          }
        },
        data: {
          price_charged: value
        }
      });
      await F.audit(tx, req, 'PRICE_OVERRIDE', String(req.body.reason), {
        job_card_id: job.id,
        price: value,
        approved_by: approval.user.id
      });
      return item;
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
  listServicesHandler,
  createServiceHandler,
  updateServiceHandler,
  overrideJobCardServicePriceHandler
};
