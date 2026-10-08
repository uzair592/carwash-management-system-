const prisma = require('../prisma');
const crypto = require('crypto');
function error(message, status = 400) {
  return Object.assign(new Error(message), {
    status
  });
}
function amount(value, {
  zero = false
} = {}) {
  const n = Number(value);
  if (value === null || value === '' || !Number.isFinite(n) || n < 0 || !zero && n === 0 || n > 99999999.99 || Math.abs(n * 100 - Math.round(n * 100)) > 0.0001) throw error('Enter a valid amount with at most two decimal places.');
  return Math.round(n * 100) / 100;
}
function cents(value) {
  return Math.round(Number(value) * 100);
}
function mode(value) {
  const s = String(value || 'CASH').toUpperCase();
  if (!['CASH', 'BANK', 'CARD'].includes(s)) throw error('Choose Cash, Bank or Card.');
  return {
    method: {
      CASH: 'Cash',
      BANK: 'Bank',
      CARD: 'Card'
    }[s],
    account: s === 'CASH' ? 'Cash_Drawer' : 'Main_Bank'
  };
}
function key(req, prefix) {
  const id = req.headers?.['idempotency-key'] || req.body?.request_key;
  if (!id || !/^[a-zA-Z0-9_-]{8,100}$/.test(id)) throw error('A valid request key is required. Please retry from the updated app.');
  return prefix + ':' + id;
}
async function transact(fn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: 'Serializable',
        maxWait: 10000,
        timeout: 20000
      });
    } catch (e) {
      if (e.code !== 'P2034' || attempt === 4) throw e;
      await new Promise(r => setTimeout(r, 20 * (attempt + 1)));
    }
  }
}
async function lock(tx, id) {
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', String(id));
}
async function movement(tx, {
  method,
  bankId,
  delta,
  kind,
  sourceId
}) {
  const {
    account
  } = mode(method);
  await lock(tx, 'financial-ledger');
  let bank = null;
  if (account === 'Main_Bank') {
    if (!bankId) throw error('Select a bank account.');
    bank = await tx.bankAccount.findUnique({
      where: {
        id: bankId
      }
    });
    if (!bank?.is_active) throw error('Choose an active bank account.');
    if (delta < 0 && cents(bank.current_balance) < -cents(delta)) throw error('Insufficient bank balance.');
  }
  const ledger = await tx.ledger.upsert({
    where: {
      account_type: account
    },
    create: {
      account_type: account,
      current_balance: 0
    },
    update: {}
  });
  if (delta < 0 && cents(ledger.current_balance) < -cents(delta)) throw error('Insufficient funds in ' + account + '.');
  const updated = await tx.ledger.update({
    where: {
      account_type: account
    },
    data: {
      current_balance: {
        increment: delta
      },
      last_updated: new Date()
    }
  });
  if (bank) await tx.bankAccount.update({
    where: {
      id: bankId
    },
    data: {
      current_balance: {
        increment: delta
      }
    }
  });
  await tx.financialMovement.create({
    data: {
      account_type: account,
      bank_account_id: bankId || null,
      amount: delta,
      kind,
      source_id: sourceId
    }
  });
  return updated;
}
async function audit(tx, req, action, description, metadata = {}) {
  await tx.auditLog.create({
    data: {
      action,
      description,
      performed_by_user_id: req.user.id,
      performed_by_name: req.user.name,
      metadata
    }
  });
}
async function alert(tx, text, eventKey) {
  await tx.alertOutbox.upsert({
    where: {
      event_key: eventKey
    },
    create: {
      type: 'TELEGRAM',
      payload: {
        text
      },
      event_key: eventKey
    },
    update: {}
  });
}
async function number(prefix, tx) {
  const day = require('../utils/business-time').dayKey().replace(/-/g, '');
  const counter = await tx.documentCounter.upsert({
    where: {
      key: prefix + ':' + day
    },
    create: {
      key: prefix + ':' + day,
      value: 1
    },
    update: {
      value: {
        increment: 1
      }
    }
  });
  return prefix + '-' + day + '-' + String(counter.value).padStart(6, '0');
}
module.exports = {
  amount,
  cents,
  mode,
  key,
  transact,
  lock,
  movement,
  audit,
  alert,
  error,
  number
};
