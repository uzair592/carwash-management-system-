const prisma = require('../prisma');

/**
 * Normalizes ledger account name.
 */
function normalizeAccount(account) {
  const norm = String(account || '').trim().toUpperCase();
  if (norm === 'CASH_DRAWER' || norm === 'CASH') return 'Cash_Drawer';
  if (norm === 'MAIN_BANK' || norm === 'BANK') return 'Main_Bank';
  throw new Error(`Invalid ledger account: "${account}". Allowed: "Cash_Drawer", "Main_Bank".`);
}

/**
 * POST /api/ledger/transfer
 * Records an internal vault transfer (e.g. depositing physical cash into the business bank account).
 * In double-entry accounting:
 * - Decrements from_account (Cash_Drawer)
 * - Increments to_account (Main_Bank)
 * - Zero impact on P&L (neither revenue nor expense)
 */
async function createTransferHandler(req, res, next) {
  try {
    const { from_account = 'Cash_Drawer', to_account = 'Main_Bank', amount, notes, pin } = req.body;

    const transferAmount = parseFloat(amount);
    if (!transferAmount || transferAmount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Transfer "amount" must be a positive number.',
      });
    }

    const sourceAccount = normalizeAccount(from_account);
    const destAccount = normalizeAccount(to_account);

    if (sourceAccount === destAccount) {
      return res.status(400).json({
        status: 'error',
        message: 'Source and destination accounts must be different.',
      });
    }

    // Optional PIN verification if PIN provided or role requires it
    if (pin) {
      const { verifyAdminOrManagerPin } = require('../middleware/auth.middleware');
      const pinCheck = await verifyAdminOrManagerPin(pin);
      if (!pinCheck.isValid) {
        return res.status(403).json({
          status: 'error',
          message: 'Invalid Admin or Manager PIN for ledger transfer authorization.',
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch Source Account
      const sourceLedger = await tx.ledger.findUnique({
        where: { account_type: sourceAccount },
      });

      const sourceBal = parseFloat(sourceLedger?.current_balance || 0);
      if (sourceBal < transferAmount) {
        throw new Error(
          `Insufficient funds in ${sourceAccount}. Current balance: Rs. ${sourceBal.toLocaleString()}, requested: Rs. ${transferAmount.toLocaleString()}`
        );
      }

      // 2. Fetch or create Destination Account
      let destLedger = await tx.ledger.findUnique({
        where: { account_type: destAccount },
      });

      if (!destLedger) {
        destLedger = await tx.ledger.create({
          data: {
            account_type: destAccount,
            current_balance: 0.00,
          },
        });
      }

      const destBal = parseFloat(destLedger.current_balance || 0);

      // 3. Decrement source, increment dest
      const newSourceBal = parseFloat((sourceBal - transferAmount).toFixed(2));
      const newDestBal = parseFloat((destBal + transferAmount).toFixed(2));

      await tx.ledger.update({
        where: { account_type: sourceAccount },
        data: { current_balance: newSourceBal, last_updated: new Date() },
      });

      await tx.ledger.update({
        where: { account_type: destAccount },
        data: { current_balance: newDestBal, last_updated: new Date() },
      });

      // 4. Create LedgerTransfer record
      const transfer = await tx.ledgerTransfer.create({
        data: {
          from_account: sourceAccount,
          to_account: destAccount,
          amount: transferAmount,
          transferred_by_id: req.user?.id || null,
          notes: notes ? notes.trim() : null,
        },
      });

      // 5. Create Audit Log
      await tx.auditLog.create({
        data: {
          action: 'LEDGER_TRANSFER',
          description: `Internal transfer of Rs. ${transferAmount.toLocaleString()} from ${sourceAccount} to ${destAccount}. Previous: [${sourceAccount}: Rs. ${sourceBal.toLocaleString()}, ${destAccount}: Rs. ${destBal.toLocaleString()}]. Notes: ${notes || 'N/A'}.`,
          performed_by_user_id: req.user?.id || null,
          performed_by_name: req.user?.name || 'Shop Admin',
          metadata: {
            transfer_id: transfer.id,
            from_account: sourceAccount,
            to_account: destAccount,
            amount: transferAmount,
            new_source_balance: newSourceBal,
            new_dest_balance: newDestBal,
          },
        },
      });

      // 6. Queue Telegram Notification
      const alertLines = [
        `🏦 *VAULT LEDGER TRANSFER RECORDED*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📤 *From:* \`${sourceAccount}\``,
        `📥 *To:*   \`${destAccount}\``,
        `💰 *Transfer Amount:* *Rs. ${transferAmount.toLocaleString()}*`,
        `───────────────────────────`,
        `📉 *New ${sourceAccount}:* Rs. ${newSourceBal.toLocaleString()}`,
        `📈 *New ${destAccount}:*   Rs. ${newDestBal.toLocaleString()}`,
        `📝 *Notes:* ${notes || 'Owner drawer deposit to business bank'}`,
        `⚖️ _P&L Neutral • Zero double-entry imbalance_`,
        `⏰ *Time:* ${new Date().toLocaleTimeString()}`,
      ];

      await tx.alertOutbox.create({
        data: {
          type: 'TELEGRAM',
          payload: { text: alertLines.join('\n') },
          status: 'PENDING',
        },
      });

      return {
        transfer,
        sourceAccount,
        newSourceBal,
        destAccount,
        newDestBal,
      };
    });

    return res.status(201).json({
      status: 'success',
      message: 'Ledger transfer executed successfully.',
      data: result.transfer,
      balances: {
        [result.sourceAccount]: result.newSourceBal,
        [result.destAccount]: result.newDestBal,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/ledger/transfers
 * Returns history of transfers
 */
async function listTransfersHandler(req, res, next) {
  try {
    const transfers = await prisma.ledgerTransfer.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return res.status(200).json({
      status: 'success',
      count: transfers.length,
      data: transfers,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTransferHandler,
  listTransfersHandler,
};
