const prisma = require('../prisma');

/**
 * Normalizes payment method string to Prisma enum & target ledger account.
 */
function parsePaymentMode(input) {
  const norm = String(input || 'CASH').trim().toUpperCase();
  if (norm === 'CASH') {
    return { enumVal: 'Cash', accountType: 'Cash_Drawer' };
  }
  if (norm === 'BANK' || norm === 'MAIN_BANK') {
    return { enumVal: 'Bank', accountType: 'Main_Bank' };
  }
  if (norm === 'CARD') {
    return { enumVal: 'Card', accountType: 'Main_Bank' };
  }
  throw new Error(`Invalid payment method: "${input}". Allowed methods: "CASH", "BANK", "CARD".`);
}

/**
 * POST /api/deposits
 * Records an advance customer deposit (e.g. for multi-day ceramic coating / PPF).
 * In double-entry accounting:
 * - Cash/Bank ledger increases (asset in vault)
 * - CustomerDeposit record created with status ACTIVE (liability owed to customer)
 * - Not recognized as revenue until applied to an invoice.
 */
async function createDepositHandler(req, res, next) {
  try {
    const { vehicle_id, customer_name, customer_phone, amount, payment_method = 'CASH', notes } = req.body;

    const depositAmount = parseFloat(amount);
    if (!depositAmount || depositAmount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Deposit "amount" must be a positive number.',
      });
    }

    if (!customer_name) {
      return res.status(400).json({
        status: 'error',
        message: 'Field "customer_name" is required for recording an advance deposit.',
      });
    }

    const { enumVal, accountType } = parsePaymentMode(payment_method);

    // Optional verification of vehicle if provided
    let vehicle = null;
    if (vehicle_id) {
      vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicle_id },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create CustomerDeposit record
      const deposit = await tx.customerDeposit.create({
        data: {
          vehicle_id: vehicle ? vehicle.id : null,
          customer_name: customer_name.trim(),
          customer_phone: customer_phone ? customer_phone.trim() : null,
          amount: depositAmount,
          payment_method: enumVal,
          status: 'ACTIVE',
          notes: notes ? notes.trim() : null,
        },
      });

      // 2. Lock and increment target ledger vault (Physical cash or Bank received)
      let ledgerAccount = await tx.ledger.findUnique({
        where: { account_type: accountType },
      });

      if (!ledgerAccount) {
        ledgerAccount = await tx.ledger.create({
          data: {
            account_type: accountType,
            current_balance: 0.00,
          },
        });
      }

      const prevBal = parseFloat(ledgerAccount.current_balance);
      const newBal = parseFloat((prevBal + depositAmount).toFixed(2));

      await tx.ledger.update({
        where: { account_type: accountType },
        data: {
          current_balance: newBal,
          last_updated: new Date(),
        },
      });

      // 3. Write Audit Log
      await tx.auditLog.create({
        data: {
          action: 'CUSTOMER_DEPOSIT_COLLECTED',
          description: `Advance deposit of Rs. ${depositAmount.toLocaleString()} collected from ${customer_name.trim()} (${vehicle?.registration_number || 'N/A'}) via ${enumVal}. Marked as Liability.`,
          performed_by_user_id: req.user?.id || null,
          performed_by_name: req.user?.name || 'Shop Cashier',
          metadata: {
            deposit_id: deposit.id,
            amount: depositAmount,
            payment_method: enumVal,
            account_type: accountType,
            previous_balance: prevBal,
            new_balance: newBal,
          },
        },
      });

      // 4. Enqueue Telegram Alert to Outbox
      const alertLines = [
        `💵 *ADVANCE DEPOSIT RECEIVED (LIABILITY)*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👤 *Customer:* *${customer_name.trim()}*`,
        `🚘 *Vehicle Plate:* *${vehicle?.registration_number || 'N/A'}*`,
        `💳 *Tender:* *${enumVal}* (\`${accountType}\`)`,
        `💰 *Deposit Amount:* *Rs. ${depositAmount.toLocaleString()}*`,
        `📈 *Vault Balance:* Rs. ${newBal.toLocaleString()}`,
        `ℹ️ _Marked as Customer Liability until final invoice checkout._`,
        `⏰ *Time:* ${new Date().toLocaleTimeString()}`,
      ];

      await tx.alertOutbox.create({
        data: {
          type: 'TELEGRAM',
          payload: { text: alertLines.join('\n') },
          status: 'PENDING',
        },
      });

      return { deposit, prevBal, newBal, accountType };
    });

    return res.status(201).json({
      status: 'success',
      message: 'Advance customer deposit recorded successfully.',
      data: result.deposit,
      ledger: {
        account_type: result.accountType,
        previous_balance: result.prevBal,
        amount_added: depositAmount,
        new_balance: result.newBal,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/deposits
 * Lists customer deposits with optional filters: vehicle_id, status, search
 */
async function listDepositsHandler(req, res, next) {
  try {
    const { vehicle_id, status, search } = req.query;

    const where = {};
    if (vehicle_id) where.vehicle_id = vehicle_id;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { customer_name: { contains: search, mode: 'insensitive' } },
        { customer_phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const deposits = await prisma.customerDeposit.findMany({
      where,
      include: {
        vehicle: true,
        invoice: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      count: deposits.length,
      data: deposits,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/deposits/active
 * Returns all unapplied active deposits
 */
async function listActiveDepositsHandler(req, res, next) {
  try {
    const { vehicle_id } = req.query;
    const where = { status: 'ACTIVE' };
    if (vehicle_id) where.vehicle_id = vehicle_id;

    const deposits = await prisma.customerDeposit.findMany({
      where,
      include: {
        vehicle: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      count: deposits.length,
      data: deposits,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createDepositHandler,
  listDepositsHandler,
  listActiveDepositsHandler,
};
