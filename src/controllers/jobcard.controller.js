const prisma = require('../prisma');

/**
 * PATCH /api/job-cards/:id/status
 * Updates status (Intake -> In_Progress -> Completed)
 * Optionally adds or updates attached services
 */
async function updateJobCardStatusHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { status, intake_notes, worker_id, services } = req.body;

    const validStatuses = ['Intake', 'In_Progress', 'Completed'];
    let formattedStatus = undefined;

    if (status) {
      // Normalize status case: e.g. "IN_PROGRESS" -> "In_Progress", "intake" -> "Intake"
      const upper = String(status).toUpperCase();
      if (upper === 'INTAKE') formattedStatus = 'Intake';
      else if (upper === 'IN_PROGRESS' || upper === 'INPROGRESS') formattedStatus = 'In_Progress';
      else if (upper === 'COMPLETED') formattedStatus = 'Completed';
      else {
        return res.status(400).json({
          status: 'error',
          message: `Invalid status "${status}". Allowed values: ${validStatuses.join(', ')}`,
        });
      }
    }

    const existing = await prisma.jobCard.findUnique({
      where: { id },
      include: { services: true },
    });

    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: `Job Card with ID "${id}" not found.`,
      });
    }

    // Update job card fields
    const updated = await prisma.jobCard.update({
      where: { id },
      data: {
        ...(formattedStatus && { status: formattedStatus }),
        ...(intake_notes !== undefined && { intake_notes }),
        ...(worker_id !== undefined && { worker_id }),
        updated_at: new Date(),
      },
      include: {
        vehicle: true,
        services: { include: { service: true } },
        invoice: true,
      },
    });

    // Optionally add new services if provided
    if (Array.isArray(services) && services.length > 0) {
      for (const item of services) {
        const serviceIdOrName = typeof item === 'string' ? item : (item.service_id || item.id || item.name);
        const serviceRecord = await prisma.service.findFirst({
          where: {
            OR: [
              { id: serviceIdOrName },
              { name: { equals: serviceIdOrName, mode: 'insensitive' } },
            ],
          },
        });

        if (serviceRecord) {
          const priceCharged = item.price ? parseFloat(item.price) : parseFloat(serviceRecord.price);
          await prisma.jobCardService.upsert({
            where: {
              job_card_id_service_id: {
                job_card_id: id,
                service_id: serviceRecord.id,
              },
            },
            update: { price_charged: priceCharged },
            create: {
              job_card_id: id,
              service_id: serviceRecord.id,
              price_charged: priceCharged,
            },
          });
        }
      }
    }

    // Fetch refreshed Job Card
    const finalJobCard = await prisma.jobCard.findUnique({
      where: { id },
      include: {
        vehicle: true,
        services: { include: { service: true } },
        invoice: true,
      },
    });

    // Telegram notification when car wash/service is marked Completed
    if (formattedStatus === 'Completed') {
      try {
        const servicesListStr = (finalJobCard.services || [])
          .map((s) => `  • ${s.service?.name || s.name || 'Wash Service'}`)
          .join('\n') || '  • Wash & Detailing Service';

        const alertLines = [
          `🚿 *CAR WASH / SERVICE COMPLETED*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🎫 *Ticket:* \`${finalJobCard.ticket_number}\``,
          `🚘 *Vehicle Plate:* *${finalJobCard.vehicle?.registration_number}*${finalJobCard.vehicle?.make ? ` (${finalJobCard.vehicle.make} ${finalJobCard.vehicle.model || ''})` : ''}`,
          `👤 *Customer:* ${finalJobCard.customer_name || finalJobCard.vehicle?.customer_name || 'Walk-in Customer'}`,
          `🛠 *Services Completed:*`,
          servicesListStr,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🏁 _Service work marked complete and ready for billing._`,
        ].join('\n');

        await prisma.alertOutbox.create({
          data: {
            type: 'TELEGRAM',
            payload: { text: alertLines, event: 'SERVICE_COMPLETED' },
            status: 'PENDING',
          },
        });

        const { processOutboxQueue } = require('../workers/outbox.worker');
        processOutboxQueue().catch((err) => console.warn('[Outbox] Flush notice:', err.message));
      } catch (alertErr) {
        console.warn('[updateJobCardStatusHandler] Outbox notice:', alertErr.message);
      }
    }

    return res.status(200).json({
      status: 'success',
      message: `Job Card status updated to "${finalJobCard.status}".`,
      data: finalJobCard,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/job-cards
 * List active job cards with vehicle and service info
 */
async function listJobCardsHandler(req, res, next) {
  try {
    const { status } = req.query;
    const where = {};
    if (status) {
      where.status = status;
    }

    const jobCards = await prisma.jobCard.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        vehicle: true,
        services: { include: { service: true } },
        invoice: true,
        media: true,
      },
    });

    return res.status(200).json({
      status: 'success',
      data: jobCards,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/job-cards/:id
 * Retrieve a specific job card
 */
async function getJobCardHandler(req, res, next) {
  try {
    const { id } = req.params;
    const jobCard = await prisma.jobCard.findUnique({
      where: { id },
      include: {
        vehicle: true,
        services: { include: { service: true } },
        invoice: true,
        media: true,
      },
    });

    if (!jobCard) {
      return res.status(404).json({
        status: 'error',
        message: `Job Card "${id}" not found.`,
      });
    }

    return res.status(200).json({
      status: 'success',
      data: jobCard,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  updateJobCardStatusHandler,
  listJobCardsHandler,
  getJobCardHandler,
};
