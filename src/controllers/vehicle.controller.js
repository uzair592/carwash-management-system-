const prisma = require('../prisma');
const { notifyJobCardCreated } = require('../services/notification.service');

/**
 * POST /api/vehicles/intake
 * Accepts registration_number, make, model, customer_phone, services[]
 * Upserts vehicle (incrementing visits if returning, initializing to 1 if new)
 * Creates JobCard in INTAKE status and dispatches Telegram notification.
 */
async function vehicleIntakeHandler(req, res, next) {
  try {
    const {
      registration_number,
      make,
      model,
      customer_phone,
      services = [], // Array of service IDs or service objects { service_id, price }
      intake_notes,
      worker_id,
      photos_url,
    } = req.body;

    if (!registration_number || !customer_phone) {
      return res.status(400).json({
        status: 'error',
        message: 'Both "registration_number" and "customer_phone" are required for vehicle intake.',
      });
    }

    const normalizedPlate = String(registration_number).trim().toUpperCase();

    // 1. Upsert Vehicle with Visit Counter Tracking
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { registration_number: normalizedPlate },
    });

    let vehicle;
    if (existingVehicle) {
      vehicle = await prisma.vehicle.update({
        where: { id: existingVehicle.id },
        data: {
          visits: { increment: 1 },
          customer_phone: customer_phone || existingVehicle.customer_phone,
          make: make || existingVehicle.make,
          model: model || existingVehicle.model,
          updated_at: new Date(),
        },
      });
    } else {
      vehicle = await prisma.vehicle.create({
        data: {
          registration_number: normalizedPlate,
          make: make || null,
          model: model || null,
          visits: 1,
          customer_phone: String(customer_phone).trim(),
        },
      });
    }

    // 2. Generate Sequential Ticket Number: CW-YYYYMMDD-XXXX
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const ticketNumber = `CW-${datePrefix}-${randomSuffix}`;

    // 3. Create Job Card in INTAKE status
    const jobCard = await prisma.jobCard.create({
      data: {
        ticket_number: ticketNumber,
        vehicle_id: vehicle.id,
        worker_id: worker_id || null,
        status: 'Intake',
        intake_notes: intake_notes || null,
        photos_url: photos_url || null,
      },
    });

    // 4. Attach Requested Services
    const assignedServices = [];
    if (Array.isArray(services) && services.length > 0) {
      for (const item of services) {
        let serviceRecord = null;
        const serviceIdOrName = typeof item === 'string' ? item : (item.service_id || item.id || item.name);

        // Find service by ID or Name
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
          const priceCharged = item.price ? parseFloat(item.price) : parseFloat(serviceRecord.price);
          await prisma.jobCardService.create({
            data: {
              job_card_id: jobCard.id,
              service_id: serviceRecord.id,
              price_charged: priceCharged,
            },
          });
          assignedServices.push({
            id: serviceRecord.id,
            name: serviceRecord.name,
            price: priceCharged,
          });
        }
      }
    }

    // 5. Query complete JobCard with relations
    const completeJobCard = await prisma.jobCard.findUnique({
      where: { id: jobCard.id },
      include: {
        vehicle: true,
        services: {
          include: { service: true },
        },
      },
    });

    // 6. Trigger Real-Time Transparency Alert (Telegram)
    notifyJobCardCreated({
      registration_number: vehicle.registration_number,
      customer_phone: vehicle.customer_phone,
      visits: vehicle.visits,
      services: assignedServices,
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
 * Lookup vehicle profile and history
 */
async function getVehicleHandler(req, res, next) {
  try {
    const { registration } = req.params;
    const vehicle = await prisma.vehicle.findUnique({
      where: { registration_number: String(registration).trim().toUpperCase() },
      include: {
        job_cards: {
          orderBy: { created_at: 'desc' },
          take: 5,
          include: { services: { include: { service: true } }, invoice: true },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({
        status: 'error',
        message: `Vehicle with registration "${registration}" not found.`,
      });
    }

    return res.status(200).json({
      status: 'success',
      data: vehicle,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  vehicleIntakeHandler,
  getVehicleHandler,
};
