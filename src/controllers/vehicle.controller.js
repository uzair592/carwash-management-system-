const prisma = require('../prisma');
const { notifyJobCardCreated } = require('../services/notification.service');

function normalizePlate(plate) {
  if (!plate) return '';
  return String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * POST /api/vehicles/intake
 * Accepts registration_number, make, model, optional customer_phone, optional customer_name, services[]
 */
async function vehicleIntakeHandler(req, res, next) {
  try {
    const {
      registration_number,
      customer_name,
      customer_phone,
      make,
      model,
      services,
      service_ids,
      intake_notes,
      worker_id,
      photos_url,
    } = req.body;

    const targetServices = Array.isArray(services) && services.length > 0 ? services : (Array.isArray(service_ids) ? service_ids : []);

    if (!registration_number || !String(registration_number).trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Registration number is required for vehicle intake.',
      });
    }

    if (targetServices.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'At least one service must be selected.',
      });
    }

    const rawPlate = String(registration_number).trim().toUpperCase();
    const normalized = normalizePlate(rawPlate);
    const cleanCustomer = customer_name && String(customer_name).trim() ? String(customer_name).trim() : 'Walk-in Customer';
    const cleanPhone = customer_phone && String(customer_phone).trim() ? String(customer_phone).trim() : null;

    // 1. Upsert Vehicle with Visit Counter
    const existingVehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [
          { normalized_plate: normalized },
          { registration_number: { equals: rawPlate, mode: 'insensitive' } },
        ],
      },
    });

    let vehicle;
    if (existingVehicle) {
      vehicle = await prisma.vehicle.update({
        where: { id: existingVehicle.id },
        data: {
          visits: { increment: 1 },
          normalized_plate: normalized,
          customer_name: cleanCustomer !== 'Walk-in Customer' ? cleanCustomer : existingVehicle.customer_name,
          customer_phone: cleanPhone || existingVehicle.customer_phone,
          make: make || existingVehicle.make,
          model: model || existingVehicle.model,
          updated_at: new Date(),
        },
      });
    } else {
      vehicle = await prisma.vehicle.create({
        data: {
          registration_number: rawPlate,
          normalized_plate: normalized,
          customer_name: cleanCustomer,
          customer_phone: cleanPhone,
          make: make || null,
          model: model || null,
          visits: 1,
        },
      });
    }

    // 2. Generate Sequential Ticket Number: CW-YYYYMMDD-XXXX
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const ticketNumber = `CW-${datePrefix}-${randomSuffix}`;

    // 3. Create Job Card in QUEUED status
    const jobCard = await prisma.jobCard.create({
      data: {
        ticket_number: ticketNumber,
        vehicle_id: vehicle.id,
        customer_name: cleanCustomer,
        worker_id: worker_id || null,
        status: 'QUEUED',
        intake_notes: intake_notes || null,
        photos_url: photos_url || null,
      },
    });

    // 4. Attach Requested Services
    const assignedServices = [];
    for (const item of targetServices) {
      let serviceRecord = null;
      const serviceIdOrName = typeof item === 'string' ? item : (item.service_id || item.id || item.name);

      if (serviceIdOrName) {
        serviceRecord = await prisma.service.findFirst({
          where: {
            OR: [
              { id: serviceIdOrName },
              { name: { equals: serviceIdOrName, mode: 'insensitive' } },
            ],
          },
        });
      }

      if (serviceRecord) {
        const priceToCharge = item.price !== undefined ? parseFloat(item.price) : parseFloat(serviceRecord.price);
        const link = await prisma.jobCardService.create({
          data: {
            job_card_id: jobCard.id,
            service_id: serviceRecord.id,
            price_charged: priceToCharge,
          },
          include: { service: true },
        });
        assignedServices.push(link);
      }
    }

    const completeJobCard = await prisma.jobCard.findUnique({
      where: { id: jobCard.id },
      include: {
        services: { include: { service: true } },
        worker: true,
      },
    });

    notifyJobCardCreated({
      registration_number: vehicle.registration_number,
      customer_phone: vehicle.customer_phone,
      visits: vehicle.visits,
      services: assignedServices.map((s) => s.service),
      ticket_number: completeJobCard.ticket_number,
      intake_time: completeJobCard.created_at,
    }).catch((err) => {
      console.error('[VehicleIntake] Notification dispatch error:', err.message);
    });

    return res.status(201).json({
      status: 'success',
      message: 'Vehicle intake completed and Job Card generated.',
      data: {
        vehicle,
        job_card: completeJobCard,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/vehicles/:registration
 * Lookup vehicle profile, history, and loyalty status
 */
async function getVehicleHandler(req, res, next) {
  try {
    const { registration } = req.params;
    const rawPlate = String(registration).trim();
    const normalized = normalizePlate(rawPlate);

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [
          { normalized_plate: normalized },
          { registration_number: { equals: rawPlate, mode: 'insensitive' } },
        ],
      },
      include: {
        job_cards: {
          orderBy: { created_at: 'desc' },
          take: 10,
          include: {
            services: { include: { service: true } },
            invoice: true,
          },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({
        status: 'error',
        message: `Vehicle with registration "${registration}" not found.`,
      });
    }

    const branding = await prisma.businessBranding.findFirst();
    const loyaltyThreshold = branding?.loyalty_threshold || 5;

    const completedVisits = vehicle.job_cards.filter(
      (j) => j.status === 'COMPLETED' || j.status === 'Completed' || Boolean(j.invoice)
    ).length;

    return res.status(200).json({
      status: 'success',
      data: {
        ...vehicle,
        completed_visits: completedVisits,
        is_returning: completedVisits > 0,
        is_loyal: completedVisits >= loyaltyThreshold,
        loyalty_threshold: loyaltyThreshold,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  vehicleIntakeHandler,
  getVehicleHandler,
};
