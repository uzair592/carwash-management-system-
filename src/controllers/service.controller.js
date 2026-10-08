const prisma = require('../prisma');

/**
 * GET /api/services
 * Returns all services (active by default, or all if include_inactive=true)
 */
async function listServicesHandler(req, res, next) {
  try {
    const { include_inactive, category } = req.query;
    const where = {};

    if (include_inactive !== 'true') {
      where.is_active = true;
    }

    if (category) {
      where.category = category;
    }

    const services = await prisma.service.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: {
        linked_inventory: true,
        service_inventories: {
          include: { inventory: true },
        },
      },
    });

    return res.status(200).json({
      status: 'success',
      count: services.length,
      data: services,
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
      inventory_deduction_amount,
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'Service "name" and "price" are required.',
      });
    }

    const priceNum = Math.max(0, parseFloat(price) || 0);
    const durationNum = Math.max(5, parseInt(estimated_time, 10) || 30);

    const newService = await prisma.service.create({
      data: {
        name: String(name).trim(),
        category: category || 'Wash',
        price: priceNum,
        estimated_time: durationNum,
        is_active: true,
        linked_inventory_id: linked_inventory_id || null,
        inventory_deduction_amount: inventory_deduction_amount
          ? parseFloat(inventory_deduction_amount)
          : null,
      },
      include: {
        linked_inventory: true,
      },
    });

    // If linked inventory specified with deduction amount, also register in service_inventory mapping
    if (linked_inventory_id && inventory_deduction_amount) {
      await prisma.serviceInventory.upsert({
        where: {
          service_id_inventory_id: {
            service_id: newService.id,
            inventory_id: linked_inventory_id,
          },
        },
        create: {
          service_id: newService.id,
          inventory_id: linked_inventory_id,
          deduction_amount: parseFloat(inventory_deduction_amount),
        },
        update: {
          deduction_amount: parseFloat(inventory_deduction_amount),
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        action: 'SERVICE_CREATED',
        description: `Service "${newService.name}" (${newService.category}) created with price Rs. ${priceNum.toLocaleString()} and duration ${durationNum} min.`,
        performed_by_user_id: req.user?.id || null,
        performed_by_name: req.user?.name || 'Shop Admin',
        metadata: { service_id: newService.id, price: priceNum, category: newService.category },
      },
    });

    return res.status(201).json({
      status: 'success',
      message: `Service "${newService.name}" added successfully.`,
      data: newService,
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
    const { id } = req.params;
    const {
      name,
      category,
      price,
      estimated_time,
      is_active,
      linked_inventory_id,
      inventory_deduction_amount,
    } = req.body;

    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Service not found.' });
    }

    const priceChanged = price !== undefined && parseFloat(price) !== parseFloat(existing.price);

    const updated = await prisma.service.update({
      where: { id },
      data: {
        name: name ? String(name).trim() : undefined,
        category: category !== undefined ? category : undefined,
        price: price !== undefined ? parseFloat(price) : undefined,
        estimated_time: estimated_time !== undefined ? parseInt(estimated_time, 10) : undefined,
        is_active: is_active !== undefined ? Boolean(is_active) : undefined,
        linked_inventory_id: linked_inventory_id !== undefined ? (linked_inventory_id || null) : undefined,
        inventory_deduction_amount: inventory_deduction_amount !== undefined
          ? (inventory_deduction_amount ? parseFloat(inventory_deduction_amount) : null)
          : undefined,
      },
      include: {
        linked_inventory: true,
      },
    });

    // Update consumable mapping if provided
    if (linked_inventory_id && inventory_deduction_amount) {
      await prisma.serviceInventory.upsert({
        where: {
          service_id_inventory_id: {
            service_id: id,
            inventory_id: linked_inventory_id,
          },
        },
        create: {
          service_id: id,
          inventory_id: linked_inventory_id,
          deduction_amount: parseFloat(inventory_deduction_amount),
        },
        update: {
          deduction_amount: parseFloat(inventory_deduction_amount),
        },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'SERVICE_UPDATED',
        description: `Service "${updated.name}" updated by ${req.user?.name || 'Admin'}.${priceChanged ? ` Price changed from Rs. ${parseFloat(existing.price).toLocaleString()} to Rs. ${parseFloat(updated.price).toLocaleString()}. (Applies to future jobs).` : ''}`,
        performed_by_user_id: req.user?.id || null,
        performed_by_name: req.user?.name || 'Shop Admin',
        metadata: {
          service_id: id,
          old_price: parseFloat(existing.price),
          new_price: parseFloat(updated.price),
          changes: req.body,
        },
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Service updated successfully.',
      data: updated,
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
    const { jobCardId, serviceId } = req.params;
    const { override_price, admin_pin, reason } = req.body;

    if (override_price === undefined) {
      return res.status(400).json({ status: 'error', message: 'Field "override_price" is required.' });
    }

    // Verify Admin/Manager PIN
    const { verifyAdminOrManagerPin } = require('../middleware/auth.middleware');
    const pinCheck = await verifyAdminOrManagerPin(admin_pin);
    if (!pinCheck.isValid) {
      return res.status(403).json({
        status: 'error',
        message: 'Admin or Manager PIN authorization is required for price override on active job card.',
      });
    }

    const jobCardService = await prisma.jobCardService.findUnique({
      where: {
        job_card_id_service_id: {
          job_card_id: jobCardId,
          service_id: serviceId,
        },
      },
      include: {
        service: true,
        job_card: { include: { vehicle: true } },
      },
    });

    if (!jobCardService) {
      return res.status(404).json({
        status: 'error',
        message: 'Service is not attached to this Job Card.',
      });
    }

    const oldPrice = parseFloat(jobCardService.price_charged);
    const newPrice = Math.max(0, parseFloat(override_price));

    const updated = await prisma.jobCardService.update({
      where: {
        job_card_id_service_id: {
          job_card_id: jobCardId,
          service_id: serviceId,
        },
      },
      data: {
        price_charged: newPrice,
      },
    });

    // Record in immutable audit log
    await prisma.auditLog.create({
      data: {
        action: 'PRICE_OVERRIDE',
        description: `Price override on Job Card ${jobCardService.job_card.ticket_number} (${jobCardService.job_card.vehicle.registration_number}) for "${jobCardService.service.name}": Rs. ${oldPrice.toLocaleString()} -> Rs. ${newPrice.toLocaleString()}. Authorized by ${pinCheck.user.name}. Reason: ${reason || 'Customer goodwill'}.`,
        performed_by_user_id: pinCheck.user.id,
        performed_by_name: pinCheck.user.name,
        metadata: {
          job_card_id: jobCardId,
          service_id: serviceId,
          service_name: jobCardService.service.name,
          ticket_number: jobCardService.job_card.ticket_number,
          old_price: oldPrice,
          new_price: newPrice,
          reason: reason || null,
        },
      },
    });

    return res.status(200).json({
      status: 'success',
      message: `Price successfully overridden to Rs. ${newPrice.toLocaleString()}.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listServicesHandler,
  createServiceHandler,
  updateServiceHandler,
  overrideJobCardServicePriceHandler,
};
