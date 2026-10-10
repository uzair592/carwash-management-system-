const prisma = require('../prisma');
const {
  notifyJobCardCreated
} = require('../services/notification.service');

// Team names mapped to physical locations
const LOCATION_TEAMS = {
  JACK_1: 'Wash Team 1',
  JACK_2: 'Wash Team 2',
  DETAILING_BAY_1: 'Detailing Bay 1',
  DETAILING_BAY_2: 'Detailing Bay 2',
  DETAILING_CENTER: 'Detailing Bay 1'
};

/**
 * Normalizes plate number for matching: strips spaces, dashes, symbols, uppercase
 * e.g., "KPK - 7890" -> "KPK7890", "lea 1234" -> "LEA1234"
 */
function normalizePlate(plate) {
  if (!plate) return '';
  return String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Format elapsed time for humans: e.g. "45m", "3h 15m", "2d 4h"
 */
function formatElapsed(startedAt) {
  if (!startedAt) return '0m';
  const diffMs = Date.now() - new Date(startedAt).getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  if (diffHours < 24) return `${diffHours}h ${remainingMins}m`;
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  return `${diffDays}d ${remainingHours}h`;
}

/**
 * Normalizes location string to WorkLocation enum
 */
function parseWorkLocation(input) {
  const norm = String(input || '').trim().toUpperCase();
  if (norm === 'JACK_1' || norm === 'JACK1' || norm === '1') return 'JACK_1';
  if (norm === 'JACK_2' || norm === 'JACK2' || norm === '2') return 'JACK_2';
  if (norm === 'DETAILING_BAY_1' || norm === 'BAY_1' || norm === 'DETAILING1' || norm === '3') return 'DETAILING_BAY_1';
  if (norm === 'DETAILING_BAY_2' || norm === 'BAY_2' || norm === 'DETAILING2' || norm === '4') return 'DETAILING_BAY_2';
  if (norm === 'DETAILING_CENTER' || norm === 'DETAILING') return 'DETAILING_BAY_1';
  throw new Error(`Invalid work location: "${input}". Allowed: JACK_1, JACK_2, DETAILING_BAY_1, DETAILING_BAY_2`);
}

/**
 * GET /api/bays/check-plate/:plate
 * Returning & loyal customer recognition via normalized registration number.
 */
async function checkPlateHandler(req, res, next) {
  try {
    const {
      plate
    } = req.params;
    if (!plate || !plate.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Plate number is required.'
      });
    }
    const rawPlate = String(plate).trim();
    const normalized = normalizePlate(rawPlate);

    // Look for matching vehicle by normalized_plate or registration_number
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [{
          normalized_plate: normalized
        }, {
          registration_number: {
            equals: rawPlate,
            mode: 'insensitive'
          }
        }, {
          registration_number: {
            equals: normalized,
            mode: 'insensitive'
          }
        }]
      },
      include: {
        job_cards: {
          orderBy: {
            created_at: 'desc'
          },
          take: 10,
          include: {
            services: {
              include: {
                service: true
              }
            },
            invoice: true
          }
        }
      }
    });

    // Get loyalty threshold from branding settings
    const branding = await prisma.businessBranding.findFirst();
    const loyaltyThreshold = branding?.loyalty_threshold || 5;
    if (!vehicle) {
      return res.status(200).json({
        status: 'success',
        data: {
          exists: false,
          normalized_plate: normalized,
          registration_number: rawPlate,
          is_returning: false,
          is_loyal: false,
          completed_visits: 0,
          vehicle: null
        }
      });
    }

    // Count strictly completed visits (excluding cancelled or pending jobs)
    const completedVisits = vehicle.job_cards.filter(j => Boolean(j.completed_at) || j.status === 'COMPLETED' || j.status === 'Completed').length;
    const lastVisit = vehicle.job_cards.find(j => Boolean(j.completed_at) || j.status === 'COMPLETED' || j.status === 'Completed');
    return res.status(200).json({
      status: 'success',
      data: {
        exists: true,
        vehicle_id: vehicle.id,
        registration_number: vehicle.registration_number,
        normalized_plate: vehicle.normalized_plate || normalized,
        customer_name: vehicle.customer_name || '',
        customer_phone: vehicle.customer_phone || '',
        make: vehicle.make,
        model: vehicle.model,
        completed_visits: completedVisits,
        is_returning: completedVisits > 0,
        is_loyal: completedVisits >= loyaltyThreshold,
        loyalty_threshold: loyaltyThreshold,
        last_visit_date: lastVisit?.created_at || null,
        last_visit_services: lastVisit?.services?.map(s => s.service?.name) || [],
        history: vehicle.job_cards.slice(0, 5)
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/intake
 * Rapid "No-Ticket, No-Work" Vehicle Intake.
 * Requirement 2: Customer Name & Customer Phone are OPTIONAL.
 * Plate Number and at least one service are REQUIRED.
 */
async function rapidIntakeHandler(req, res, next) {
  try {
    const F = require('../services/finance.service');
    const rawPlate = String(req.body.registration_number || '').trim().toUpperCase(),
      normalized = normalizePlate(rawPlate);
    if (!/^[A-Z0-9]{3,20}$/.test(normalized)) throw F.error('Enter a valid vehicle plate.');
    const selected = req.body.services?.length ? req.body.services : req.body.service_ids;
    if (!Array.isArray(selected) || !selected.length) throw F.error('Select at least one service.');
    const requestKey = F.key(req, 'intake');
    const result = await F.transact(async tx => {
      await F.lock(tx, requestKey);
      const previous = await tx.jobCard.findUnique({
        where: {
          request_key: requestKey
        },
        include: {
          vehicle: true,
          services: {
            include: {
              service: true
            }
          }
        }
      });
      if (previous) return previous;
      await F.lock(tx, 'plate:' + normalized);
      const services = [];
      const ids = new Set();
      for (const item of selected) {
        const id = typeof item === 'string' ? item : item.service_id || item.id || item.name;
        const service = await tx.service.findFirst({
          where: {
            is_active: true,
            OR: [{
              id
            }, {
              name: {
                equals: id,
                mode: 'insensitive'
              }
            }]
          }
        });
        if (!service || ids.has(service.id)) throw F.error('A selected service is unavailable or duplicated.');
        ids.add(service.id);
        const price = typeof item === 'object' && item.price !== undefined ? F.amount(item.price, {
          zero: true
        }) : Number(service.price);
        if (F.cents(price) !== F.cents(service.price)) {
          if (!String(req.body.override_reason || '').trim() || !(await require('../services/permission.service').approval(req, 'billing.discount')).isValid) throw F.error('Price changes require Admin PIN and a reason.', 403);
        }
        services.push({
          service_id: service.id,
          price_charged: price
        });
      }
      const existing = await tx.vehicle.findFirst({
        where: {
          OR: [{
            normalized_plate: normalized
          }, {
            registration_number: rawPlate
          }]
        }
      });
      const fields = {
        normalized_plate: normalized,
        ...(req.body.customer_name?.trim() ? {
          customer_name: req.body.customer_name.trim()
        } : {}),
        ...(req.body.customer_phone?.trim() ? {
          customer_phone: req.body.customer_phone.trim()
        } : {}),
        ...(req.body.make ? {
          make: req.body.make
        } : {}),
        ...(req.body.model ? {
          model: req.body.model
        } : {})
      };
      const vehicle = existing ? await tx.vehicle.update({
        where: {
          id: existing.id
        },
        data: fields
      }) : await tx.vehicle.create({
        data: {
          registration_number: rawPlate,
          ...fields,
          visits: 0
        }
      });
      const job = await tx.jobCard.create({
        data: {
          request_key: requestKey,
          ticket_number: await F.number('CW', tx),
          vehicle_id: vehicle.id,
          customer_name: req.body.customer_name?.trim() || vehicle.customer_name || 'Walk-in',
          status: 'QUEUED',
          intake_notes: req.body.intake_notes || null,
          services: {
            create: services
          }
        },
        include: {
          vehicle: true,
          services: {
            include: {
              service: true
            }
          }
        }
      });
      await F.audit(tx, req, 'JOB_CREATED', 'Work ticket created.', {
        job_card_id: job.id,
        override_reason: req.body.override_reason || null
      });
      await F.alert(tx, 'Vehicle arrived: ' + vehicle.registration_number + ' — ticket ' + job.ticket_number, requestKey);
      return job;
    });
    res.status(201).json({
      status: 'success',
      data: {
        job_card: result,
        vehicle: result.vehicle
      }
    });
  } catch (e) {
    next(e);
  }
}

/**
 * PATCH /api/job-cards/:id/start
 * Assigns vehicle to Washing Jack 1, Washing Jack 2, Detailing Bay 1, or Detailing Bay 2.
 * Supports assigning multiple workers to detailing jobs.
 */
async function startJobCardHandler(req, res, next) {
  try {
    const F = require('../services/finance.service');
    const location = parseWorkLocation(req.body.assigned_location || req.body.location);
    const id = req.params.id;
    const result = await F.transact(async tx => {
      await F.lock(tx, 'bay:' + location);
      const job = await tx.jobCard.findUnique({
        where: {
          id
        },
        include: {
          invoice: true
        }
      });
      if (!job) throw F.error('Job not found.', 404);
      if (job.invoice || !['QUEUED', 'Intake', 'IN_PROGRESS', 'In_Progress'].includes(job.status)) throw F.error('Only an active workshop job can be assigned.');
      if (['IN_PROGRESS', 'In_Progress'].includes(job.status) && job.assigned_location === location) return tx.jobCard.findUnique({
        where: {
          id
        },
        include: {
          vehicle: true,
          services: {
            include: {
              service: true
            }
          },
          assigned_workers: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });
      const occupied = await tx.jobCard.findFirst({
        where: {
          assigned_location: location,
          status: {
            in: ['IN_PROGRESS', 'In_Progress']
          },
          id: {
            not: id
          }
        }
      });
      if (occupied) throw F.error('This bay is occupied.', 409);
      const workers = [...new Set(req.body.worker_ids?.length ? req.body.worker_ids : req.body.worker_id ? [req.body.worker_id] : [])];
      for (const workerId of workers) {
        const worker = await tx.user.findUnique({
          where: {
            id: workerId
          }
        });
        if (!worker?.is_active || worker.role !== 'Worker') throw F.error('Choose active workshop workers.');
      }
      await tx.jobCard.update({
        where: {
          id
        },
        data: {
          status: 'IN_PROGRESS',
          assigned_location: location,
          assigned_team: req.body.assigned_team || LOCATION_TEAMS[location],
          worker_id: workers[0] || null,
          started_at: job.started_at || new Date()
        }
      });
      await tx.jobCardWorker.deleteMany({
        where: {
          job_card_id: id
        }
      });
      for (const workerId of workers) await tx.jobCardWorker.create({
        data: {
          job_card_id: id,
          user_id: workerId
        }
      });
      await F.audit(tx, req, 'JOB_STARTED', 'Vehicle assigned to ' + location, {
        job_card_id: id,
        workers
      });
      return tx.jobCard.findUnique({
        where: {
          id
        },
        include: {
          vehicle: true,
          services: {
            include: {
              service: true
            }
          },
          assigned_workers: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          media: true
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

/**
 * PATCH /api/job-cards/:id/complete
 * Marks car as READY_FOR_BILLING, records completed_at = now(),
 * and releases ONLY its own assigned slot.
 */
async function completeJobCardHandler(req, res, next) {
  try {
    const F = require('../services/finance.service');
    const result = await F.transact(async tx => {
      await F.lock(tx, 'job:' + req.params.id);
      const job = await tx.jobCard.findUnique({
        where: {
          id: req.params.id
        },
        include: {
          invoice: true,
          vehicle: true,
          services: {
            include: {
              service: {
                include: {
                  service_inventories: {
                    include: {
                      inventory: true
                    }
                  }
                }
              }
            }
          },
          material_issuances: true,
          assigned_workers: {
            include: {
              user: true
            }
          },
          worker: true
        }
      });
      if (!job) throw F.error('Job not found.', 404);
      if (job.invoice) throw F.error('An invoiced job is locked.');
      if (job.status === 'READY_FOR_BILLING') return job;
      if (!['IN_PROGRESS', 'In_Progress'].includes(job.status)) throw F.error('Start work before marking it complete.');

      // Consume configured service yield once. Explicit material issues count toward
      // the configured quantity to prevent charging stock twice for the same job.
      const requiredByInventory = new Map();
      for (const line of job.services || []) {
        const service = line.service;
        const mappings = service?.service_inventories?.length
          ? service.service_inventories
          : service?.linked_inventory_id && service?.inventory_deduction_amount != null
            ? [{ inventory_id: service.linked_inventory_id, deduction_amount: service.inventory_deduction_amount }]
            : [];
        for (const mapping of mappings) {
          const inventoryId = mapping.inventory_id || mapping.inventory?.id;
          if (!inventoryId) continue;
          const amount = F.amount(mapping.deduction_amount, { zero: true });
          if (amount <= 0) continue;
          requiredByInventory.set(inventoryId, (requiredByInventory.get(inventoryId) || 0) + F.cents(amount));
        }
      }
      const manuallyIssued = new Map();
      for (const issuance of job.material_issuances || []) {
        if (!issuance.inventory_id) continue;
        manuallyIssued.set(issuance.inventory_id, (manuallyIssued.get(issuance.inventory_id) || 0) + F.cents(issuance.quantity_issued));
      }
      for (const inventoryId of [...requiredByInventory.keys()].sort()) {
        const quantityCents = Math.max(0, requiredByInventory.get(inventoryId) - (manuallyIssued.get(inventoryId) || 0));
        if (!quantityCents) continue;
        await F.lock(tx, 'stock:' + inventoryId);
        const requestKey = 'service_use_' + job.id + '_' + inventoryId;
        const previousIssue = await tx.materialIssuance.findUnique({ where: { request_key: requestKey } });
        if (previousIssue) continue;
        const item = await tx.inventory.findUnique({ where: { id: inventoryId } });
        if (!item) throw F.error('A configured service inventory item no longer exists. Correct the service mapping before completing this job.', 409);
        if (F.cents(item.current_stock) < quantityCents) throw F.error('Insufficient stock to complete this job. Restock inventory or correct the service deduction.', 409);
        const quantity = quantityCents / 100;
        await tx.materialIssuance.create({
          data: {
            job_card_id: job.id,
            inventory_id: inventoryId,
            quantity_issued: quantity,
            unit_cost: item.cost_per_unit,
            issued_by_id: req.user.id,
            notes: 'Automatic service consumption at workshop completion.',
            request_key: requestKey
          }
        });
        const stockAfter = await tx.inventory.update({
          where: { id: inventoryId },
          data: { current_stock: { decrement: quantity } }
        });
        await F.audit(tx, req, 'SERVICE_MATERIAL_CONSUMED', 'Configured service consumables deducted at workshop completion.', {
          job_card_id: job.id,
          inventory_id: inventoryId,
          quantity,
          unit_cost: Number(item.cost_per_unit)
        });
        if (Number(stockAfter.current_stock) <= Number(item.low_stock_threshold)) {
          await F.alert(tx, 'Low stock: ' + item.item_name + ' — ' + stockAfter.current_stock, requestKey);
        }
      }

      const assigned = job.assigned_workers.length ? job.assigned_workers.map(w => w.user) : job.worker ? [job.worker] : [];
      const snapshot = assigned.map(w => ({
        id: w.id,
        name: w.name,
        flat: Number(w.flat_commission),
        rate: Number(w.commission_rate),
        share: 1 / Math.max(1, assigned.length)
      }));
      const updated = await tx.jobCard.update({
        where: {
          id: job.id
        },
        data: {
          status: 'READY_FOR_BILLING',
          completed_at: new Date(),
          commission_snapshot: snapshot
        },
        include: {
          vehicle: true,
          services: {
            include: {
              service: true
            }
          },
          assigned_workers: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          media: true
        }
      });
      await tx.vehicle.update({
        where: {
          id: job.vehicle_id
        },
        data: {
          visits: {
            increment: 1
          }
        }
      });
      await F.audit(tx, req, 'JOB_COMPLETED', 'Workshop work completed.', {
        job_card_id: job.id
      });
      await F.alert(tx, 'Work completed: ' + job.vehicle.registration_number, 'job-complete:' + job.id);
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

/**
 * GET /api/bays/live-status
 * Real-time physical shop overview with 4 distinct slots:
 * - Washing Jack 1 (Wash Team 1)
 * - Washing Jack 2 (Wash Team 2)
 * - Detailing Bay 1 (Detailing Team)
 * - Detailing Bay 2 (Detailing Team)
 */
async function getLiveBayStatusHandler(req, res, next) {
  try {
    const allActiveCards = await prisma.jobCard.findMany({
      where: {
        status: {
          in: ['QUEUED', 'IN_PROGRESS', 'READY_FOR_BILLING', 'Intake', 'In_Progress']
        }
      },
      include: {
        vehicle: true,
        services: {
          include: {
            service: true
          }
        },
        worker: {
          select: {
            id: true,
            name: true,
            commission_rate: true
          }
        },
        assigned_workers: {
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        media: true,
        invoice: true
      },
      orderBy: {
        created_at: 'asc'
      }
    });

    // Map physical active occupants (status IN_PROGRESS or In_Progress)
    const inProgressList = allActiveCards.filter(j => (j.status === 'IN_PROGRESS' || j.status === 'In_Progress') && !j.invoice);
    const jack1 = inProgressList.find(j => j.assigned_location === 'JACK_1') || null;
    const jack2 = inProgressList.find(j => j.assigned_location === 'JACK_2') || null;
    const detailing1 = inProgressList.find(j => j.assigned_location === 'DETAILING_BAY_1' || j.assigned_location === 'DETAILING_CENTER') || null;
    const detailing2 = inProgressList.find(j => j.assigned_location === 'DETAILING_BAY_2') || null;

    // Helper to format slot job with elapsed time & workers
    function formatSlotJob(job) {
      if (!job) return null;
      const totalEstimatedMinutes = (job.services || []).reduce((sum, s) => sum + (s.service?.estimated_time || 30), 0);
      const workersList = job.assigned_workers && job.assigned_workers.length > 0 ? job.assigned_workers.map(aw => aw.user?.name).filter(Boolean) : job.worker ? [job.worker.name] : [];
      return {
        ...job,
        elapsed_display: formatElapsed(job.started_at),
        estimated_minutes: totalEstimatedMinutes,
        assigned_worker_names: workersList
      };
    }

    // Queued waiting vehicles
    const queuedCars = allActiveCards.filter(j => (j.status === 'QUEUED' || j.status === 'Intake') && !j.invoice);

    // Ready for Cashier Billing
    const readyCars = allActiveCards.filter(j => (j.status === 'READY_FOR_BILLING' || j.status === 'Completed') && !j.invoice);
    return res.status(200).json({
      status: 'success',
      physical_bays: {
        jack_1: {
          location: 'JACK_1',
          name: 'Washing Jack 1',
          team: 'Wash Team 1',
          is_occupied: Boolean(jack1),
          current_job: formatSlotJob(jack1)
        },
        jack_2: {
          location: 'JACK_2',
          name: 'Washing Jack 2',
          team: 'Wash Team 2',
          is_occupied: Boolean(jack2),
          current_job: formatSlotJob(jack2)
        },
        detailing_bay_1: {
          location: 'DETAILING_BAY_1',
          name: 'Detailing Slot 1',
          team: 'Detailing Team',
          is_occupied: Boolean(detailing1),
          current_job: formatSlotJob(detailing1)
        },
        detailing_bay_2: {
          location: 'DETAILING_BAY_2',
          name: 'Detailing Slot 2',
          team: 'Detailing Team',
          is_occupied: Boolean(detailing2),
          current_job: formatSlotJob(detailing2)
        },
        // Alias for backwards compatibility
        detailing_center: {
          location: 'DETAILING_CENTER',
          name: 'Detailing Slot 1',
          team: 'Detailing Team',
          is_occupied: Boolean(detailing1),
          current_job: formatSlotJob(detailing1)
        }
      },
      queue: queuedCars,
      ready_for_billing: readyCars,
      as_of: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/verify-pin
 * Verifies Shop Admin PIN (Default: 1234 or hashed)
 */
async function verifyAdminPinHandler(req, res, next) {
  try {
    const {
      pin
    } = req.body;
    const {
      verifyAdminOrManagerPin
    } = require('../middleware/auth.middleware');
    const result = await verifyAdminOrManagerPin(pin);
    return res.status(200).json({
      status: 'success',
      valid: result.isValid,
      user: result.user ? {
        id: result.user.id,
        name: result.user.name,
        role: result.role
      } : null
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
    const F = require('../services/finance.service');
    const approved = await require('../services/permission.service').approval(req, 'billing.refund');
    if (!approved.isValid || !String(req.body.reason || '').trim()) throw F.error('Admin approval and refund reason required.', 403);
    const value = F.amount(req.body.amount);
    const requestKey = F.key(req, 'refund');
    const invoiceId = req.params.id;
    const result = await F.transact(async tx => {
      await F.lock(tx, 'invoice:' + invoiceId);
      const previous = await tx.refund.findFirst({
        where: {
          request_key: {
            startsWith: requestKey + ':'
          }
        }
      });
      if (previous) {
        if (previous.invoice_id !== invoiceId) throw F.error('Request key belongs to another invoice.');
        return previous;
      }
      const invoice = await tx.invoice.findUnique({
        where: {
          id: invoiceId
        },
        include: {
          payments: true,
          refunds: true
        }
      });
      if (!invoice) throw F.error('Invoice not found.', 404);
      if (F.cents(value) > F.cents(invoice.paid_amount)) throw F.error('Refund exceeds the remaining amount actually paid.');
      const tender = new Map();
      const add = (method, bank, amount) => {
        const k = method + ':' + (bank || '');
        const row = tender.get(k) || {
          method,
          bank,
          amount: 0
        };
        row.amount += F.cents(amount);
        tender.set(k, row);
      };
      for (const payment of invoice.payments) add(payment.payment_method, payment.bank_account_id, payment.amount);
      const applications = await tx.depositApplication.findMany({
        where: {
          invoice_id: invoiceId
        }
      });
      for (const application of applications) {
        const dep = await tx.customerDeposit.findUnique({
          where: {
            id: application.deposit_id
          }
        });
        add(dep.payment_method, dep.bank_account_id, application.amount);
      }
      for (const refund of invoice.refunds) add(refund.payment_method, refund.bank_account_id, -Number(refund.amount));
      if (!tender.size) throw F.error('Legacy invoice requires verified payment allocation before refund.');
      let remaining = F.cents(value),
        index = 0,
        first;
      for (const row of tender.values()) {
        const applied = Math.min(remaining, Math.max(0, row.amount));
        if (!applied) continue;
        const refund = await tx.refund.create({
          data: {
            invoice_id: invoiceId,
            amount: applied / 100,
            reason: String(req.body.reason).trim(),
            authorized_by_pin: 'APPROVED',
            payment_method: row.method,
            bank_account_id: row.bank,
            request_key: requestKey + ':' + index++
          }
        });
        first ||= refund;
        await F.movement(tx, {
          method: row.method,
          bankId: row.bank,
          delta: -applied / 100,
          kind: 'REFUND',
          sourceId: refund.id
        });
        remaining -= applied;
        if (!remaining) break;
      }
      if (remaining) throw F.error('Refund cannot exceed the available payment allocation.');
      const paid = (F.cents(invoice.paid_amount) - F.cents(value)) / 100;
      await tx.invoice.update({
        where: {
          id: invoiceId
        },
        data: {
          paid_amount: paid,
          // A refund is money returned, not a discount against the customer's bill.
          balance_due: (F.cents(invoice.total_amount) - F.cents(paid)) / 100,
          status: paid ? 'PARTIAL_REFUND' : 'REFUNDED'
        }
      });
      await F.audit(tx, req, 'INVOICE_REFUND', String(req.body.reason), {
        invoice_id: invoiceId,
        amount: value,
        approved_by: approved.user.id
      });
      await F.alert(tx, 'Approved refund Rs. ' + value, requestKey);
      return first;
    });
    res.json({
      status: 'success',
      data: {
        refund: result,
        restored_inventory: []
      }
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  normalizePlate,
  checkPlateHandler,
  rapidIntakeHandler,
  startJobCardHandler,
  completeJobCardHandler,
  getLiveBayStatusHandler,
  verifyAdminPinHandler,
  issueRefundHandler
};
