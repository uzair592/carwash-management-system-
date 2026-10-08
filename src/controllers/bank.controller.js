const prisma = require('../prisma');

/**
 * GET /api/banks
 * List all bank accounts with balances and status
 */
async function listBankAccountsHandler(req, res, next) {
  try {
    const { include_inactive } = req.query;
    const where = include_inactive === 'true' ? {} : { is_active: true };

    const accounts = await prisma.bankAccount.findMany({
      where,
      orderBy: { created_at: 'asc' },
      include: {
        _count: {
          select: {
            payments: true,
            transfers_from: true,
            transfers_to: true,
          },
        },
      },
    });

    // Also get cash ledger balance for overall overview
    const cashLedger = await prisma.ledger.findUnique({
      where: { account_type: 'Cash_Drawer' },
    });
    const mainBankLedger = await prisma.ledger.findUnique({
      where: { account_type: 'Main_Bank' },
    });

    return res.status(200).json({
      status: 'success',
      data: {
        accounts,
        cash_balance: parseFloat(cashLedger?.current_balance || 0),
        total_bank_ledger: parseFloat(mainBankLedger?.current_balance || 0),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/banks
 * Create a new bank account
 */
async function createBankAccountHandler(req, res, next) {
  try {
    const { bank_name, account_title, account_number, initial_balance = 0 } = req.body;

    if (!bank_name || !account_title || !account_number) {
      return res.status(400).json({
        status: 'error',
        message: 'Bank Name, Account Title, and Account Number / IBAN are required.',
      });
    }

    const initBal = Math.max(0, parseFloat(initial_balance) || 0);

    const newAccount = await prisma.bankAccount.create({
      data: {
        bank_name: String(bank_name).trim(),
        account_title: String(account_title).trim(),
        account_number: String(account_number).trim(),
        current_balance: initBal,
        is_active: true,
      },
    });

    // If initial balance > 0, reflect in Main_Bank ledger
    if (initBal > 0) {
      await prisma.ledger.upsert({
        where: { account_type: 'Main_Bank' },
        create: { account_type: 'Main_Bank', current_balance: initBal },
        update: { current_balance: { increment: initBal } },
      });
    }

    await prisma.auditLog.create({
      data: {
        action: 'BANK_ACCOUNT_CREATED',
        description: `New bank account "${newAccount.bank_name} - ${newAccount.account_number}" created with initial balance Rs. ${initBal.toLocaleString()}`,
        performed_by_user_id: req.user?.id || null,
        performed_by_name: req.user?.name || 'Shop Admin',
        metadata: { bank_account_id: newAccount.id, initial_balance: initBal },
      },
    });

    return res.status(201).json({
      status: 'success',
      message: `Bank account "${newAccount.bank_name}" added successfully.`,
      data: newAccount,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/banks/:id
 * Update bank account details (name, title, account number, status)
 */
async function updateBankAccountHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { bank_name, account_title, account_number, is_active } = req.body;

    const existing = await prisma.bankAccount.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Bank account not found.',
      });
    }

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: {
        bank_name: bank_name ? String(bank_name).trim() : undefined,
        account_title: account_title ? String(account_title).trim() : undefined,
        account_number: account_number ? String(account_number).trim() : undefined,
        is_active: is_active !== undefined ? Boolean(is_active) : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'BANK_ACCOUNT_UPDATED',
        description: `Bank account "${updated.bank_name} - ${updated.account_number}" updated by ${req.user?.name || 'Admin'}`,
        performed_by_user_id: req.user?.id || null,
        performed_by_name: req.user?.name || 'Shop Admin',
        metadata: { bank_account_id: id, changes: req.body },
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Bank account updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/banks/:id
 * Safeguard: Prevent deletion of accounts with financial history; allow deactivation instead.
 */
async function deleteBankAccountHandler(req, res, next) {
  try {
    const { id } = req.params;

    const account = await prisma.bankAccount.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            payments: true,
            transfers_from: true,
            transfers_to: true,
          },
        },
      },
    });

    if (!account) {
      return res.status(404).json({
        status: 'error',
        message: 'Bank account not found.',
      });
    }

    const totalTxCount =
      account._count.payments + account._count.transfers_from + account._count.transfers_to;

    if (totalTxCount > 0 || parseFloat(account.current_balance) > 0) {
      // Prevent hard delete, deactivate instead
      const deactivated = await prisma.bankAccount.update({
        where: { id },
        data: { is_active: false },
      });

      await prisma.auditLog.create({
        data: {
          action: 'BANK_ACCOUNT_DEACTIVATED',
          description: `Bank account "${account.bank_name} - ${account.account_number}" has ${totalTxCount} recorded transactions and cannot be deleted. Deactivated instead.`,
          performed_by_user_id: req.user?.id || null,
          performed_by_name: req.user?.name || 'Shop Admin',
          metadata: { bank_account_id: id },
        },
      });

      return res.status(200).json({
        status: 'deactivated',
        message: `Account cannot be deleted because it contains ${totalTxCount} historical transactions. The account has been deactivated instead.`,
        data: deactivated,
      });
    }

    // Clean account with 0 balance and 0 history can be safely deleted
    await prisma.bankAccount.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: 'BANK_ACCOUNT_DELETED',
        description: `Unused bank account "${account.bank_name} - ${account.account_number}" deleted.`,
        performed_by_user_id: req.user?.id || null,
        performed_by_name: req.user?.name || 'Shop Admin',
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Bank account deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/banks/:id/transactions
 * Retrieve statement/transaction history for a specific bank account
 */
async function getBankAccountTransactionsHandler(req, res, next) {
  try {
    const { id } = req.params;

    const account = await prisma.bankAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return res.status(404).json({
        status: 'error',
        message: 'Bank account not found.',
      });
    }

    const payments = await prisma.payment.findMany({
      where: { bank_account_id: id },
      include: {
        invoice: {
          include: {
            job_card: {
              include: { vehicle: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    const transfersFrom = await prisma.ledgerTransfer.findMany({
      where: { from_bank_account_id: id },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    const transfersTo = await prisma.ledgerTransfer.findMany({
      where: { to_bank_account_id: id },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return res.status(200).json({
      status: 'success',
      data: {
        account,
        payments,
        transfers_from: transfersFrom,
        transfers_to: transfersTo,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listBankAccountsHandler,
  createBankAccountHandler,
  updateBankAccountHandler,
  deleteBankAccountHandler,
  getBankAccountTransactionsHandler,
};
