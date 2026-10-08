const prisma = require('../prisma');
const { notifyJobCardCreated } = require('../services/notification.service');

// Team names mapped to physical locations
const LOCATION_TEAMS = {
  JACK_1: 'Wash Team 1',
  JACK_2: 'Wash Team 2',
  DETAILING_CENTER: 'Detailing Team',
};

/**
 * Normalizes location string to WorkLocation enum
 */
function parseWorkLocation(input) {
  const norm = String(input || '').trim().toUpperCase();
  if (norm === 'JACK_1' || norm === 'JACK1' || norm === '1') return 'JACK_1';
  if (norm === 'JACK_2' || norm === 'JACK2' || norm === '2') return 'JACK_2';
  if (norm === 'DETAILING_CENTER' || norm === 'DETAILING' || norm === '3') return 'DETAILING_CENTER';
  throw new Error(`Invalid work location: "${input}". Allowed: JACK_1, JACK_2, DETAILING_CENTER`);
}

/**
 * POST /api/intake
 * Rapid "No-Ticket, No-Work" Vehicle Intake.
 * Accepts Plate Number, Customer Name, Customer Phone, and Service Package.
 * Generates sequential ticket and sets JobCard status to QUEUED.
 */
async function rapidIntakeHandler(req, res, next) {
  try {
    const {
      registration_number,
      customer_name,
      customer_phone,
      make,
      model,
      services = [],
      service_ids = [],
      intake_notes,
    } = req.body;

    if (!registration_number || !customer_name || !customer_phone) {
      return res.status(400).json({
        status: 'error',
        message: 'Plate Number, Customer Name, and Customer Phone are strictly required.',
      });
    }

    const normalizedPlate = String(registration_number).trim().toUpperCase();
    const cleanCustomerName = String(customer_name).trim();
    const cleanPhone = String(customer_phone).trim();

    // 1. Upsert Vehicle with Customer Name
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { registration_number: normalizedPlate },
    });

    let vehicle;
    if (existingVehicle) {
      vehicle = await prisma.vehicle.update({
        where: { id: existingVehicle.id },
        data: {
          visits: { increment: 1 },
          customer_name: cleanCustomerName,
          customer_phone: cleanPhone,
          make: make || existingVehicle.make,
          model: model || existingVehicle.model,
          updated_at: new Date(),
        },
      });
    } else {
      vehicle = await prisma.vehicle.create({
        data: {
          registration_number: normalizedPlate,
          customer_name: cleanCustomerName,
          customer_phone: cleanPhone,
          make: make || null,
          model: model || null,
          visits: 1,
        },
      });
    }

    // 2. Generate Ticket Number: CW-YYYYMMDD-XXXX
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const ticketNumber = `CW-${datePrefix}-${randomSuffix}`;

    // 3. Create Job Card in QUEUED status
    const jobCard = await prisma.jobCard.create({
      data: {
        ticket_number: ticketNumber,
        vehicle_id: vehicle.id,
        customer_name: cleanCustomerName,
        status: 'QUEUED',
        intake_notes: intake_notes || null,
      },
    });

    // 4. Attach Service Packages
    const rawServices = Array.isArray(services) && services.length > 0 ? services : service_ids;
    const attachedServices = [];

    if (Array.isArray(rawServices) && rawServices.length > 0) {
      for (const item of rawServices) {
        const idOrName = typeof item === 'string' ? item : (item.service_id || item.id || item.name);
        const srv = await prisma.service.findFirst({
          where: {
            OR: [
              { id: idOrName },
              { name: { equals: idOrName, mode: 'insensitive' } },
            ],
          },
        });

        if (srv) {
          const priceCharged = item.price ? parseFloat(item.price) : parseFloat(srv.price);
          const link = await prisma.jobCardService.create({
            data: {
              job_card_id: jobCard.id,
              service_id: srv.id,
              price_charged: priceCharged,
            },
            include: { service: true },
          });
          attachedServices.push(link);
        }
      }
    }

    // 5. Fire non-blocking Telegram intake alert
    notifyJobCardCreated({
      registration_number: vehicle.registration_number,
      customer_phone: vehicle.customer_phone,
      visits: vehicle.visits,
      services: attachedServices.map((s) => s.service.name),
      ticket_number: jobCard.ticket_number,
      intake_time: jobCard.created_at,
    }).catch((err) => console.warn('[RapidIntake] Telegram alert notice:', err.message));

    const completeCard = await prisma.jobCard.findUnique({
      where: { id: jobCard.id },
      include: {
        vehicle: true,
        services: { include: { service: true } },
      },
    });

    return res.status(201).json({
      status: 'success',
      message: `Job Card ${ticketNumber} queued successfully for ${normalizedPlate}.`,
      data: {
        job_card: completeCard,
        vehicle,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/job-cards/:id/start
 * Assigns vehicle to Washing Jack 1, Washing Jack 2, or Detailing Center.
 * Sets started_at = now() and status = IN_PROGRESS.
 */
async function startJobCardHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { assigned_location, location, assigned_team, worker_id, force = false } = req.body;
    const targetLocation = assigned_location || location;

    if (!targetLocation) {
      return res.status(400).json({
        status: 'error',
        message: 'Field "assigned_location" (JACK_1, JACK_2, or DETAILING_CENTER) is required.',
      });
    }

    const locationEnum = parseWorkLocation(targetLocation);
    const teamName = assigned_team || LOCATION_TEAMS[locationEnum];

    // Check if another car is currently occupying this bay
    if (!force) {
      const activeOccupant = await prisma.jobCard.findFirst({
        where: {
          assigned_location: locationEnum,
          status: 'IN_PROGRESS',
          id: { not: id },
        },
        include: { vehicle: true },
      });

      if (activeOccupant) {
        return res.status(409).json({
          status: 'conflict',
          message: `${locationEnum.replace('_', ' ')} is already occupied by vehicle ${activeOccupant.vehicle.registration_number} (Ticket ${activeOccupant.ticket_number}). Please mark it complete first or choose another jack.`,
          current_occupant: activeOccupant,
        });
      }
    }

    const updated = await prisma.jobCard.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        assigned_location: locationEnum,
        assigned_team: teamName,
        worker_id: worker_id || undefined,
        started_at: new Date(),
        updated_at: new Date(),
      },
      include: {
        vehicle: true,
        services: { include: { service: true } },
        worker: true,
        media: true,
      },
    });

    return res.status(200).json({
      status: 'success',
      message: `Vehicle ${updated.vehicle.registration_number} started work in ${locationEnum.replace('_', ' ')} under ${teamName}.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/job-cards/:id/complete
 * Marks car as READY_FOR_BILLING, records completed_at = now(),
 * and visually frees up the physical Jack / Detailing Center for the next car.
 */
async function completeJobCardHandler(req, res, next) {
  try {
    const { id } = req.params;

    const jobCard = await prisma.jobCard.findUnique({
      where: { id },
      include: { vehicle: true },
    });

    if (!jobCard) {
      return res.status(404).json({ status: 'error', message: 'Job Card not found.' });
    }

    const updated = await prisma.jobCard.update({
      where: { id },
      data: {
        status: 'READY_FOR_BILLING',
        completed_at: new Date(),
        updated_at: new Date(),
      },
      include: {
        vehicle: true,
        services: { include: { service: true } },
        worker: true,
        media: true,
      },
    });

    return res.status(200).json({
      status: 'success',
      message: `Vehicle ${updated.vehicle.registration_number} completed. ${updated.assigned_location || 'Bay'} is now FREE for the next car. Vehicle moved to Ready For Billing.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/bays/live-status
 * Real-time physical shop overview matching the 3 physical zones:
 * - Washing Jack 1 (Wash Team 1)
 * - Washing Jack 2 (Wash Team 2)
 * - Detailing Center (Detailing Team)
 * Plus Queue and Ready for Billing list.
 */
async function getLiveBayStatusHandler(req, res, next) {
  try {
    const allActiveCards = await prisma.jobCard.findMany({
      where: {
        status: { in: ['QUEUED', 'IN_PROGRESS', 'READY_FOR_BILLING', 'Intake', 'In_Progress'] },
      },
      include: {
        vehicle: true,
        services: { include: { service: true } },
        worker: true,
        media: true,
        invoice: true,
      },
      orderBy: { created_at: 'asc' },
    });

    // Map physical active occupants (status IN_PROGRESS or In_Progress)
    const inProgressList = allActiveCards.filter((j) => (j.status === 'IN_PROGRESS' || j.status === 'In_Progress') && !j.invoice);

    const jack1 = inProgressList.find((j) => j.assigned_location === 'JACK_1') || null;
    const jack2 = inProgressList.find((j) => j.assigned_location === 'JACK_2') || null;
    const detailing = inProgressList.find((j) => j.assigned_location === 'DETAILING_CENTER') || null;

    // Queued waiting vehicles
    const queuedCars = allActiveCards.filter((j) => (j.status === 'QUEUED' || j.status === 'Intake') && !j.invoice);

    // Ready for Cashier Billing
    const readyCars = allActiveCards.filter((j) => (j.status === 'READY_FOR_BILLING' || j.status === 'Completed') && !j.invoice);

    return res.status(200).json({
      status: 'success',
      physical_bays: {
        jack_1: {
          location: 'JACK_1',
          name: 'Washing Jack 1',
          team: 'Wash Team 1',
          is_occupied: Boolean(jack1),
          current_job: jack1,
        },
        jack_2: {
          location: 'JACK_2',
          name: 'Washing Jack 2',
          team: 'Wash Team 2',
          is_occupied: Boolean(jack2),
          current_job: jack2,
        },
        detailing_center: {
          location: 'DETAILING_CENTER',
          name: 'Detailing Center',
          team: 'Detailing Team',
          is_occupied: Boolean(detailing),
          current_job: detailing,
        },
      },
      queue: queuedCars,
      ready_for_billing: readyCars,
      as_of: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/verify-pin
 * Verifies Shop Admin PIN (Default: 1234)
 */
async function verifyAdminPinHandler(req, res, next) {
  try {
    const { pin } = req.body;
    const { verifyAdminOrManagerPin } = require('../middleware/auth.middleware');
    const result = await verifyAdminOrManagerPin(pin);
    return res.status(200).json({
      status: 'success',
      valid: result.isValid,
      user: result.user ? { id: result.user.id, name: result.user.name, role: result.role } : null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/invoices/:id/refund
 * Issues an immutable refund/credit note requiring Admin PIN authorization.
 * Reverses ledger atomically and queues Outbox alert.
 */
async function issueRefundHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { amount, reason, admin_pin } = req.body;

    if (!admin_pin || !amount || !reason) {
      return res.status(400).json({
        status: 'error',
        message: 'Refund amount, reason, and admin_pin are strictly required.',
      });
    }

    // Verify Admin or Manager PIN
    const { verifyAdminOrManagerPin } = require('../middleware/auth.middleware');
    const { logAuditEvent } = require('../services/audit.service');
    const pinCheck = await verifyAdminOrManagerPin(admin_pin);
    if (!pinCheck.isValid) {
      return res.status(403).json({
        status: 'error',
        message: 'Unauthorized: Invalid Admin / Manager PIN.',
      });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        job_card: {
          include: {
            vehicle: true,
            services: { include: { service: true } },
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ status: 'error', message: 'Invoice not found.' });
    }

    const refundAmount = Math.max(0, parseFloat(amount));
    const accountType = invoice.payment_method === 'Cash' ? 'Cash_Drawer' : 'Main_Bank';
    const vehiclePlate = invoice.job_card?.vehicle?.registration_number || 'N/A';

    // Execute atomic refund transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Refund record
      const createdRefund = await tx.refund.create({
        data: {
          invoice_id: invoice.id,
          amount: refundAmount,
          reason: String(reason).trim(),
          authorized_by_pin: String(admin_pin),
        },
      });

      // 2. Adjust Ledger Vault (Outflow deduction)
      let ledger = await tx.ledger.findUnique({ where: { account_type: accountType } });
      const prevBal = parseFloat(ledger.current_balance);
      const newBal = parseFloat((prevBal - refundAmount).toFixed(2));

      await tx.ledger.update({
        where: { account_type: accountType },
        data: {
          current_balance: newBal,
          last_updated: new Date(),
        },
      });

      // 3. Restore Deducted Consumable Inventory (Yield Engine Reversal)
      const restoredItems = [];
      if (invoice.job_card?.services) {
        for (const jobService of invoice.job_card.services) {
          const srvId = jobService.service_id;

          // Check ServiceInventory mappings
          const yieldMaps = await tx.serviceInventory.findMany({
            where: { service_id: srvId },
          });

          for (const ym of yieldMaps) {
            const addBack = parseFloat(ym.deduction_amount);
            const inv = await tx.inventory.update({
              where: { id: ym.inventory_id },
              data: {
                current_stock: { increment: addBack },
                updated_at: new Date(),
              },
            });
            restoredItems.push(`${addBack} ${inv.unit_type} of ${inv.item_name}`);
          }

          // Legacy single consumable link
          if (jobService.service?.linked_inventory_id && jobService.service?.inventory_deduction_amount) {
            const addBackLegacy = parseFloat(jobService.service.inventory_deduction_amount);
            const invLegacy = await tx.inventory.update({
              where: { id: jobService.service.linked_inventory_id },
              data: {
                current_stock: { increment: addBackLegacy },
                updated_at: new Date(),
              },
            });
            restoredItems.push(`${addBackLegacy} ${invLegacy.unit_type} of ${invLegacy.item_name}`);
          }
        }
      }

      // 4. Record Immutable Audit Log
      await tx.auditLog.create({
        data: {
          action: 'INVOICE_REFUND',
          description: `Credit Note / Refund of Rs. ${refundAmount.toLocaleString()} issued for Invoice ${invoice.invoice_number} (${vehiclePlate}). Reason: "${reason}". Restored: [${restoredItems.join(', ') || 'No inventory tied'}].`,
          performed_by_user_id: pinCheck.user?.id || null,
          performed_by_name: pinCheck.user ? `${pinCheck.user.name} (${pinCheck.role})` : 'Shop Admin',
          metadata: {
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            refund_amount: refundAmount,
            reason: reason,
            restored_inventory: restoredItems,
          },
        },
      });

      // 5. Queue Outbox Alert
      const alertText = [
        `🔴 *REFUND / CREDIT NOTE ISSUED*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🧾 *Invoice:* \`${invoice.invoice_number}\``,
        `🚘 *Vehicle:* *${vehiclePlate}*`,
        `💸 *Refund Amount:* *Rs. ${refundAmount.toLocaleString()}*`,
        `📝 *Reason:* ${reason}`,
        `🔑 *Authorized By:* ${pinCheck.user?.name || 'Admin'} (${pinCheck.role})`,
        `📉 *New Vault Balance:* Rs. ${newBal.toLocaleString()}`,
        restoredItems.length > 0 ? `📦 *Restored Consumables:* ${restoredItems.join(', ')}` : '',
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].filter(Boolean).join('\n');

      await tx.alertOutbox.create({
        data: {
          type: 'TELEGRAM',
          payload: { text: alertText },
          status: 'PENDING',
        },
      });

      return {
        refund: createdRefund,
        new_balance: newBal,
        restored_inventory: restoredItems,
      };
    });

    return res.status(200).json({
      status: 'success',
      message: `Refund of Rs. ${refundAmount} authorized and processed atomically.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  rapidIntakeHandler,
  startJobCardHandler,
  completeJobCardHandler,
  getLiveBayStatusHandler,
  verifyAdminPinHandler,
  issueRefundHandler,
};
