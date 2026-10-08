const prisma = require('../prisma');

/**
 * Normalizes ledger account name.
 */
function normalizeAccount(account) {
  const norm = String(account || '').trim().toUpperCase();
  if (norm === 'CASH_DRAWER' || norm === 'CASH') return 'Cash_Drawer';
  if (norm === 'MAIN_BANK' || norm === 'BANK') return 'Main_Bank';
  return 'Cash_Drawer';
}

/**
 * POST /api/ledger/transfer
 * Records an internal vault/bank transfer.
 * Supported transfer types:
 * - CASH_TO_BANK: Cash_Drawer -> BankAccount (updates Cash_Drawer ledger, Main_Bank ledger, and target BankAccount)
 * - BANK_TO_CASH: BankAccount -> Cash_Drawer (updates source BankAccount, Main_Bank ledger, and Cash_Drawer ledger)
 * - BANK_TO_BANK: BankAccount A -> BankAccount B (updates source BankAccount, dest BankAccount; Main_Bank ledger net 0)
 *
 * In double-entry accounting:
 * - Zero impact on P&L (neither revenue nor expense)
 * - Balanced ledger entries
 */
async function createTransferHandler(req, res, next) {
  try {
    const {
      transfer_type = 'CASH_TO_BANK',
      from_account,
      to_account,
      from_bank_account_id,
      to_bank_account_id,
      amount,
      notes,
      pin,
    } = req.body;

    const transferAmount = parseFloat(amount);
    if (!transferAmount || transferAmount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Transfer "amount" must be a positive number.',
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

    // Determine normalized transfer type
    let cleanType = String(transfer_type).toUpperCase();
    if (from_bank_account_id && to_bank_account_id) {
      cleanType = 'BANK_TO_BANK';
    } else if (from_bank_account_id && !to_bank_account_id) {
      cleanType = 'BANK_TO_CASH';
    } else if (!from_bank_account_id && to_bank_account_id) {
      cleanType = 'CASH_TO_BANK';
    }

    const result = await prisma.$transaction(async (tx) => {
      let sourceName = 'Cash Drawer';
      let destName = 'Business Bank';
      let sourceLedgerType = 'Cash_Drawer';
      let destLedgerType = 'Main_Bank';

      // 1. Check & Handle Source
      if (cleanType === 'CASH_TO_BANK') {
        sourceLedgerType = 'Cash_Drawer';
        destLedgerType = 'Main_Bank';
        sourceName = 'Cash Drawer';

        const cashLedger = await tx.ledger.findUnique({
          where: { account_type: 'Cash_Drawer' },
        });
        const cashBal = parseFloat(cashLedger?.current_balance || 0);
        if (cashBal < transferAmount) {
          throw new Error(
            `Insufficient cash in Cash Drawer. Available: Rs. ${cashBal.toLocaleString()}, Requested: Rs. ${transferAmount.toLocaleString()}`
          );
        }

        // Decrement Cash Drawer
        await tx.ledger.update({
          where: { account_type: 'Cash_Drawer' },
          data: { current_balance: { decrement: transferAmount }, last_updated: new Date() },
        });

        // Increment Main Bank ledger
        await tx.ledger.upsert({
          where: { account_type: 'Main_Bank' },
          create: { account_type: 'Main_Bank', current_balance: transferAmount },
          update: { current_balance: { increment: transferAmount }, last_updated: new Date() },
        });

        // If specific bank account is selected, increment its balance
        if (to_bank_account_id) {
          const bankAcc = await tx.bankAccount.findUnique({ where: { id: to_bank_account_id } });
          if (!bankAcc) throw new Error('Destination bank account not found.');
          destName = `${bankAcc.bank_name} (${bankAcc.account_number})`;
          await tx.bankAccount.update({
            where: { id: to_bank_account_id },
            data: { current_balance: { increment: transferAmount } },
          });
        }
      } else if (cleanType === 'BANK_TO_CASH') {
        sourceLedgerType = 'Main_Bank';
        destLedgerType = 'Cash_Drawer';
        destName = 'Cash Drawer';

        if (!from_bank_account_id) {
          throw new Error('Source bank account must be specified for Bank to Cash transfer.');
        }

        const sourceBank = await tx.bankAccount.findUnique({ where: { id: from_bank_account_id } });
        if (!sourceBank) throw new Error('Source bank account not found.');
        sourceName = `${sourceBank.bank_name} (${sourceBank.account_number})`;

        const bankBal = parseFloat(sourceBank.current_balance || 0);
        if (bankBal < transferAmount) {
          throw new Error(
            `Insufficient funds in ${sourceName}. Available: Rs. ${bankBal.toLocaleString()}, Requested: Rs. ${transferAmount.toLocaleString()}`
          );
        }

        // Decrement Bank Account
        await tx.bankAccount.update({
          where: { id: from_bank_account_id },
          data: { current_balance: { decrement: transferAmount } },
        });

        // Decrement Main Bank ledger
        await tx.ledger.update({
          where: { account_type: 'Main_Bank' },
          data: { current_balance: { decrement: transferAmount }, last_updated: new Date() },
        });

        // Increment Cash Drawer ledger
        await tx.ledger.upsert({
          where: { account_type: 'Cash_Drawer' },
          create: { account_type: 'Cash_Drawer', current_balance: transferAmount },
          update: { current_balance: { increment: transferAmount }, last_updated: new Date() },
        });
      } else if (cleanType === 'BANK_TO_BANK') {
        sourceLedgerType = 'Main_Bank';
        destLedgerType = 'Main_Bank';

        if (!from_bank_account_id || !to_bank_account_id) {
          throw new Error('Both source and destination bank accounts must be specified.');
        }
        if (from_bank_account_id === to_bank_account_id) {
          throw new Error('Source and destination bank accounts cannot be the same.');
        }

        const sourceBank = await tx.bankAccount.findUnique({ where: { id: from_bank_account_id } });
        const destBank = await tx.bankAccount.findUnique({ where: { id: to_bank_account_id } });

        if (!sourceBank || !destBank) throw new Error('One or both bank accounts not found.');

        sourceName = `${sourceBank.bank_name} (${sourceBank.account_number})`;
        destName = `${destBank.bank_name} (${destBank.account_number})`;

        const bankBal = parseFloat(sourceBank.current_balance || 0);
        if (bankBal < transferAmount) {
          throw new Error(
            `Insufficient funds in ${sourceName}. Available: Rs. ${bankBal.toLocaleString()}, Requested: Rs. ${transferAmount.toLocaleString()}`
          );
        }

        // Decrement source bank
        await tx.bankAccount.update({
          where: { id: from_bank_account_id },
          data: { current_balance: { decrement: transferAmount } },
        });

        // Increment destination bank
        await tx.bankAccount.update({
          where: { id: to_bank_account_id },
          data: { current_balance: { increment: transferAmount } },
        });
        // Overall Main_Bank ledger remains unchanged
      }

      // Record Transfer
      const transfer = await tx.ledgerTransfer.create({
        data: {
          transfer_type: cleanType,
          from_account: sourceLedgerType,
          to_account: destLedgerType,
          from_bank_account_id: from_bank_account_id || null,
          to_bank_account_id: to_bank_account_id || null,
          amount: transferAmount,
          transferred_by_id: req.user?.id || null,
          notes: notes ? String(notes).trim() : null,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: 'LEDGER_TRANSFER',
          description: `Internal transfer of Rs. ${transferAmount.toLocaleString()} from "${sourceName}" to "${destName}" (${cleanType}). Notes: ${notes || 'N/A'}.`,
          performed_by_user_id: req.user?.id || null,
          performed_by_name: req.user?.name || 'Shop Admin',
          metadata: {
            transfer_id: transfer.id,
            transfer_type: cleanType,
            from: sourceName,
            to: destName,
            amount: transferAmount,
          },
        },
      });

      // Outbox notification
      const alertLines = [
        `🏦 *VAULT / BANK TRANSFER RECORDED*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🔄 *Type:* \`${cleanType}\``,
        `📤 *From:* ${sourceName}`,
        `📥 *To:*   ${destName}`,
        `💰 *Transfer Amount:* *Rs. ${transferAmount.toLocaleString()}*`,
        `📝 *Notes:* ${notes || 'Internal fund transfer'}`,
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
        cleanType,
        sourceName,
        destName,
      };
    });

    return res.status(201).json({
      status: 'success',
      message: `Successfully transferred Rs. ${transferAmount.toLocaleString()} from ${result.sourceName} to ${result.destName}.`,
      data: result.transfer,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/ledger/transfers
 * Returns history of transfers with bank account details
 */
async function listTransfersHandler(req, res, next) {
  try {
    const transfers = await prisma.ledgerTransfer.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
      include: {
        from_bank_account: true,
        to_bank_account: true,
      },
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
