const prisma = require('../prisma');

/**
 * POST /api/materials/issue
 * Workers declare material usage (e.g. "Used 30ml Ceramic") while car is IN_PROGRESS.
 * Deducts stock instantly, decouples consumption from invoice checkout.
 */
async function issueMaterialHandler(req, res, next) {
  try {
    const { job_card_id, inventory_id, quantity_issued, notes, issued_by_id } = req.body;

    if (!job_card_id || !inventory_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Fields "job_card_id" and "inventory_id" are required.',
      });
    }

    const qty = parseFloat(quantity_issued);
    if (!qty || qty <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Field "quantity_issued" must be a positive number.',
      });
    }

    // 1. Validate Job Card is active
    const jobCard = await prisma.jobCard.findUnique({
      where: { id: job_card_id },
      include: { vehicle: true },
    });

    if (!jobCard) {
      return res.status(404).json({
        status: 'error',
        message: `Job Card "${job_card_id}" not found.`,
      });
    }

    if (jobCard.status === 'COMPLETED' || jobCard.status === 'Cancelled') {
      return res.status(400).json({
        status: 'error',
        message: `Cannot issue materials to Job Card "${jobCard.ticket_number}" because its status is ${jobCard.status}.`,
      });
    }

    // 2. Validate Inventory Item
    const item = await prisma.inventory.findUnique({
      where: { id: inventory_id },
    });

    if (!item) {
      return res.status(404).json({
        status: 'error',
        message: `Inventory item "${inventory_id}" not found.`,
      });
    }

    const curStock = parseFloat(item.current_stock);
    const newStock = Math.max(0, parseFloat((curStock - qty).toFixed(2)));
    const threshold = parseFloat(item.low_stock_threshold || 10);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Decrement inventory stock
      const updatedItem = await tx.inventory.update({
        where: { id: inventory_id },
        data: {
          current_stock: newStock,
          updated_at: new Date(),
        },
      });

      // 2. Create MaterialIssuance record
      const issuance = await tx.materialIssuance.create({
        data: {
          job_card_id,
          inventory_id,
          quantity_issued: qty,
          issued_by_id: issued_by_id || req.user?.id || null,
          notes: notes ? notes.trim() : null,
        },
        include: {
          inventory: true,
          job_card: {
            include: { vehicle: true },
          },
        },
      });

      // 3. Write Audit Log
      await tx.auditLog.create({
        data: {
          action: 'MATERIAL_ISSUED',
          description: `Issued ${qty} ${item.unit_type} of "${item.item_name}" to Ticket #${jobCard.ticket_number} (${jobCard.vehicle?.registration_number || 'N/A'}). Remaining stock: ${newStock} ${item.unit_type}.`,
          performed_by_user_id: req.user?.id || null,
          performed_by_name: req.user?.name || 'Bay Technician',
          metadata: {
            issuance_id: issuance.id,
            job_card_id,
            ticket_number: jobCard.ticket_number,
            inventory_id,
            item_name: item.item_name,
            quantity_issued: qty,
            previous_stock: curStock,
            new_stock: newStock,
          },
        },
      });

      // 4. Low stock alert if threshold breached
      if (newStock <= threshold) {
        const lowStockText = [
          `⚠️ *LOW STOCK ALERT: CONSUMABLE DEPLETED*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📦 *Consumable:* *${item.item_name}*`,
          `📉 *Current Stock:* *${newStock} ${item.unit_type}*`,
          `⚡ *Threshold Alert:* ${threshold} ${item.unit_type}`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `⚠️ Restock immediately to avoid bay work delays.`,
        ].join('\n');

        await tx.alertOutbox.create({
          data: {
            type: 'TELEGRAM',
            payload: { text: lowStockText },
            status: 'PENDING',
          },
        });
      }

      return { issuance, updatedItem };
    });

    return res.status(201).json({
      status: 'success',
      message: `Successfully issued ${qty} ${item.unit_type} of ${item.item_name}.`,
      data: result.issuance,
      inventory: {
        id: result.updatedItem.id,
        item_name: result.updatedItem.item_name,
        current_stock: parseFloat(result.updatedItem.current_stock),
        unit_type: result.updatedItem.unit_type,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/materials/job-card/:id
 * Lists all materials issued to a specific job card
 */
async function getJobCardMaterialsHandler(req, res, next) {
  try {
    const { id } = req.params;

    const issuances = await prisma.materialIssuance.findMany({
      where: { job_card_id: id },
      include: {
        inventory: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      count: issuances.length,
      data: issuances,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  issueMaterialHandler,
  getJobCardMaterialsHandler,
};
