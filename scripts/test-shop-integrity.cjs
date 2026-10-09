// Controller regression tests with rollback-capable fixtures. These do not emulate PostgreSQL locking.
const {
  test,
  beforeEach
} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
process.env.JWT_SECRET = 'test-only-secret-that-is-longer-than-thirty-two-characters';
let state,
  serial = 0;
function matches(row, where = {}) {
  return Object.entries(where).every(([k, v]) => {
    const x = row[k];
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('equals' in v) {
        const value = v.path ? v.path.reduce((value, key) => value?.[key], x) : x;
        return v.mode === 'insensitive' && typeof value === 'string' ? value.toLowerCase() === String(v.equals).toLowerCase() : value === v.equals;
      }
      if ('in' in v) return v.in.includes(x);
      if ('startsWith' in v) return typeof x === 'string' && x.startsWith(v.startsWith);
      if ('gte' in v && x < v.gte) return false;
      if ('lte' in v && x > v.lte) return false;
      if ('gt' in v && !(x > v.gt)) return false;
      return true;
    }
    return x === v;
  });
}
function hydrate(model, row, include) {
  if (!row) return null;
  const result = structuredClone(row);
  if (model === 'jobCard') {
    result.invoice = state.invoice.find(i => i.job_card_id === row.id) || null;
    result.vehicle = state.vehicle.find(v => v.id === row.vehicle_id);
    if (state.jobCardService?.length) result.services = state.jobCardService.filter(s => s.job_card_id === row.id).map(s => ({
      ...s,
      service: state.service.find(item => item.id === s.service_id)
    }));
    result.assigned_workers ||= [];
    result.material_issuances ||= [];
  }
  if (model === 'invoice') {
    result.payments = state.payment.filter(p => p.invoice_id === row.id);
    result.refunds = state.refund.filter(p => p.invoice_id === row.id);
    result.deposits = state.customerDeposit.filter(d => d.applied_to_invoice_id === row.id);
    result.job_card = hydrate('jobCard', state.jobCard.find(j => j.id === row.job_card_id));
  }
  if (model === 'materialIssuance') result.inventory = state.inventory.find(i => i.id === row.inventory_id);
  return result;
}
function patch(row, data) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && ('increment' in v || 'decrement' in v)) row[k] = Number(row[k] || 0) + (v.increment ?? -v.decrement);else row[k] = v;
  }
  return row;
}
const models = ['user', 'vehicle', 'jobCard', 'invoice', 'payment', 'customerDeposit', 'depositApplication', 'expense', 'inventory', 'materialIssuance', 'bankAccount', 'ledger', 'financialMovement', 'auditLog', 'alertOutbox', 'documentCounter', 'refund', 'registerSession', 'service', 'jobCardService', 'printerSetting', 'printerJob', 'businessBranding', 'serviceInventory'];
const db = {};
for (const model of models) db[model] = {
  async count(args = {}) {
    return state[model].filter(r => matches(r, args.where)).length;
  },
  async aggregate(args = {}) {
    const rows = state[model].filter(r => matches(r, args.where));
    return {
      _sum: Object.fromEntries(Object.keys(args._sum || {}).map(k => [k, rows.reduce((sum, row) => sum + Number(row[k] || 0), 0)]))
    };
  },
  async findUnique({
    where,
    include
  }) {
    return hydrate(model, state[model].find(r => matches(r, where)), include);
  },
  async findFirst(args = {}) {
    return this.findUnique({
      where: args.where || {},
      include: args.include
    });
  },
  async findMany(args = {}) {
    return state[model].filter(r => matches(r, args.where)).map(r => hydrate(model, r, args.include));
  },
  async create({
    data,
    include
  }) {
    const row = {
      id: model + '-' + ++serial,
      created_at: new Date(),
      ...structuredClone(data)
    };
    if (model === 'customerDeposit') row.status ||= 'ACTIVE';
    if (model === 'alertOutbox') {
      row.status ||= 'PENDING';
      row.attempts ||= 0;
      row.next_attempt_at ||= new Date(0);
    }
    if (model === 'printerJob') row.status ||= 'SENDING';
    if (model === 'invoice') row.discount_amount ||= 0;
    state[model].push(row);
    return hydrate(model, row, include);
  },
  async update({
    where,
    data,
    include
  }) {
    const row = state[model].find(r => matches(r, where));
    if (!row) throw Error('Missing ' + model);
    patch(row, data);
    return hydrate(model, row, include);
  },
  async delete({
    where
  }) {
    const value = state[model].find(r => matches(r, where));
    if (!value) throw Error('Missing ' + model);
    state[model] = state[model].filter(r => !matches(r, where));
    return structuredClone(value);
  },
  async deleteMany({
    where
  }) {
    const removed = state[model].filter(r => matches(r, where));
    state[model] = state[model].filter(r => !matches(r, where));
    return {
      count: removed.length
    };
  },
  async updateMany({
    where,
    data
  }) {
    const rows = state[model].filter(r => matches(r, where));
    rows.forEach(r => patch(r, data));
    return {
      count: rows.length
    };
  },
  async upsert({
    where,
    create,
    update
  }) {
    return state[model].some(r => matches(r, where)) ? this.update({
      where,
      data: update
    }) : this.create({
      data: create
    });
  }
};
db.$executeRawUnsafe = async () => 1;
db.$transaction = async fn => {
  const snapshot = structuredClone(state);
  try {
    return await fn(db);
  } catch (e) {
    state = snapshot;
    throw e;
  }
};
require.cache[require.resolve('../src/prisma')] = {
  exports: db
};
let deliveryWorks = false;
require.cache[require.resolve('../src/services/notification.service')] = {
  exports: {
    notifyJobCardCreated: async () => {},
    sendTelegramMessage: async () => ({
      sent: deliveryWorks,
      error: 'offline'
    }),
    sendSMSReceipt: async () => ({
      sent: deliveryWorks
    })
  }
};
const security = require('../src/utils/security');
const auth = require('../src/middleware/auth.middleware');
const F = require('../src/services/finance.service');
const expense = require('../src/controllers/expense.controller');
const material = require('../src/controllers/material.controller');
const invoice = require('../src/controllers/invoice.controller');
const deposit = require('../src/controllers/deposit.controller');
const users = require('../src/controllers/user.controller');
const outbox = require('../src/workers/outbox.worker');
const time = require('../src/utils/business-time');
async function call(handler, body = {}, extra = {}) {
  let result = {
      status: 200
    },
    error;
  const res = {
    status(code) {
      result.status = code;
      return this;
    },
    json(value) {
      result.body = value;
      return this;
    },
    cookie() {
      return this;
    },
    clearCookie() {
      return this;
    }
  };
  await handler({
    user: {
      id: 'admin',
      name: 'Owner',
      role: 'ADMIN'
    },
    body,
    params: {},
    query: {},
    headers: {
      'idempotency-key': 'test-request-123'
    },
    ...extra
  }, res, e => {
    error = e;
  });
  if (error) throw error;
  return result;
}
beforeEach(() => {
  state = Object.fromEntries(models.map(m => [m, []]));
  state.user = [{
    id: 'admin',
    name: 'Owner',
    role: 'Admin',
    is_active: true,
    session_version: 0,
    pin_code: security.hashSecret('8765')
  }];
  state.ledger = [{
    account_type: 'Cash_Drawer',
    current_balance: 5000
  }, {
    account_type: 'Main_Bank',
    current_balance: 5000
  }];
  state.bankAccount = [{
    id: 'bank',
    is_active: true,
    current_balance: 5000
  }];
  state.vehicle = [{
    id: 'car',
    registration_number: 'ABC123'
  }, {
    id: 'other',
    registration_number: 'XYZ456'
  }];
  state.jobCard = [{
    id: 'job',
    vehicle_id: 'car',
    status: 'READY_FOR_BILLING',
    services: [{
      price_charged: 1000,
      service: {
        name: 'Wash',
        category: 'Wash'
      }
    }]
  }];
  deliveryWorks = false;
});
test('Money validation rejects negative, nonfinite and sub-cent amounts', () => {
  for (const v of [-1, NaN, Infinity, '', null, 1.001]) assert.throws(() => F.amount(v));
  assert.equal(F.amount('12.30'), 12.3);
  assert.equal(F.amount(0, {
    zero: true
  }), 0);
});
test('Tokens reject tampering and expire; stored secrets are salted', () => {
  const token = security.generateToken({
    id: 'admin',
    version: 0
  });
  assert.equal(security.verifyToken(token).id, 'admin');
  const payload = JSON.parse(Buffer.from(token, 'base64url'));
  payload.data.id = 'attacker';
  assert.equal(security.verifyToken(Buffer.from(JSON.stringify(payload)).toString('base64url')), null);
  const real = Date.now;
  try {
    Date.now = () => real() + 9 * 3600000;
    assert.equal(security.verifyToken(token), null);
  } finally {
    Date.now = real;
  }
  const hash = security.hashSecret('secret');
  assert.notEqual(hash, security.hashSecret('secret'));
  assert(security.verifySecret('secret', hash));
  assert(!security.verifySecret('wrong', hash));
});
test('Forged role headers never authenticate; inactive and revoked users are blocked', async () => {
  assert.equal((await call(auth.authenticateUser, {}, {
    headers: {
      'x-user-role': 'ADMIN',
      'x-user-id': 'admin'
    }
  })).status, 401);
  const headers = {
    authorization: 'Bearer ' + security.generateToken({
      id: 'admin',
      version: 0
    })
  };
  let passed = false;
  await auth.authenticateUser({
    headers
  }, {
    status() {
      throw Error('rejected valid token');
    }
  }, () => {
    passed = true;
  });
  assert(passed);
  state.user[0].session_version++;
  assert.equal((await call(auth.authenticateUser, {}, {
    headers
  })).status, 401);
  state.user[0].session_version = 0;
  state.user[0].is_active = false;
  assert.equal((await call(auth.authenticateUser, {}, {
    headers
  })).status, 401);
});
test('Only stored approval PINs work and Workers cannot reset the owner', async () => {
  assert.equal((await auth.verifyAdminOrManagerPin('1234')).isValid, false);
  assert.equal((await auth.verifyAdminOrManagerPin('8765')).isValid, true);
  assert.equal((await call(users.resetPasswordHandler, {
    new_password: 'valid-password'
  }, {
    user: {
      id: 'worker',
      role: 'WORKER'
    },
    params: {
      id: 'admin'
    }
  })).status, 403);
});
test('Expense retries produce one movement, one audit and one outbox item', async () => {
  const body = {
    amount: 250,
    category: 'Supplies',
    payment_method: 'BANK',
    bank_account_id: 'bank'
  };
  await call(expense.createExpenseHandler, body);
  await call(expense.createExpenseHandler, body);
  assert.equal(state.expense.length, 1);
  assert.equal(state.bankAccount[0].current_balance, 4750);
  assert.equal(state.ledger[1].current_balance, 4750);
  assert.equal(state.financialMovement.length, 1);
  assert.equal(state.auditLog.length, 1);
  assert.equal(state.alertOutbox.length, 1);
});
test('Failed bank validation rolls back the entire expense transaction', async () => {
  await assert.rejects(call(expense.createExpenseHandler, {
    amount: 250,
    category: 'Supplies',
    payment_method: 'BANK'
  }), /Select a bank/);
  assert.equal(state.expense.length, 0);
  assert.equal(state.ledger[1].current_balance, 5000);
  assert.equal(state.auditLog.length, 0);
});
test('Advances retain excess liability and duplicate checkout does not collect again', async () => {
  await call(deposit.createDepositHandler, {
    vehicle_id: 'car',
    amount: 1500,
    payment_method: 'CASH'
  });
  const id = state.customerDeposit[0].id;
  const body = {
    job_card_id: 'job',
    applied_deposit_ids: [id],
    collected_amount: 0
  };
  const first = await call(invoice.checkoutHandler, body);
  const second = await call(invoice.checkoutHandler, body);
  assert.equal(first.body.data.invoice.id, second.body.data.invoice.id);
  assert.equal(state.customerDeposit[0].remaining_amount, 500);
  assert.equal(state.depositApplication[0].amount, 1000);
  assert.equal(state.ledger[0].current_balance, 6500);
  assert.equal(state.invoice.length, 1);
  assert.equal(state.payment.length, 0);
});
test('Checkout rejects unrelated advances, excessive collection and low cash tender', async () => {
  await call(deposit.createDepositHandler, {
    vehicle_id: 'other',
    amount: 100,
    payment_method: 'CASH'
  });
  await assert.rejects(call(invoice.checkoutHandler, {
    job_card_id: 'job',
    applied_deposit_ids: [state.customerDeposit[0].id]
  }), /does not belong/);
  await assert.rejects(call(invoice.checkoutHandler, {
    job_card_id: 'job',
    collected_amount: 1100
  }), /exceeds/);
  await assert.rejects(call(invoice.checkoutHandler, {
    job_card_id: 'job',
    collected_amount: 1000,
    cash_tendered: 900
  }), /tender/i);
  assert.equal(state.invoice.length, 0);
});
test('Split checkout allocates each payment to its actual account', async () => {
  await call(invoice.checkoutHandler, {
    job_card_id: 'job',
    payments: [{
      payment_method: 'CASH',
      amount: 400
    }, {
      payment_method: 'BANK',
      bank_account_id: 'bank',
      amount: 600
    }]
  });
  assert.equal(state.ledger[0].current_balance, 5400);
  assert.equal(state.ledger[1].current_balance, 5600);
  assert.equal(state.bankAccount[0].current_balance, 5600);
  assert.equal(state.invoice[0].paid_amount, 1000);
  assert.equal(state.invoice[0].balance_due, 0);
});
test('Material shortage rolls back; retry does not issue stock twice', async () => {
  state.jobCard[0].status = 'IN_PROGRESS';
  state.inventory = [{
    id: 'stock',
    item_name: 'Ceramic',
    current_stock: 40,
    cost_per_unit: 20,
    low_stock_threshold: 5
  }];
  await assert.rejects(call(material.issueMaterialHandler, {
    job_card_id: 'job',
    inventory_id: 'stock',
    quantity_issued: 50
  }), /Insufficient/);
  await call(material.issueMaterialHandler, {
    job_card_id: 'job',
    inventory_id: 'stock',
    quantity_issued: 30
  });
  await call(material.issueMaterialHandler, {
    job_card_id: 'job',
    inventory_id: 'stock',
    quantity_issued: 30
  });
  assert.equal(state.inventory[0].current_stock, 10);
  assert.equal(state.materialIssuance.length, 1);
  assert.equal(state.materialIssuance[0].unit_cost, 20);
});
test('Unsent alerts remain failed and are retried to delivery', async () => {
  await F.alert(db, 'Test alert', 'test-alert');
  await outbox.processOutboxQueue();
  assert.equal(state.alertOutbox[0].status, 'FAILED');
  assert.equal(state.alertOutbox[0].attempts, 1);
  state.alertOutbox[0].next_attempt_at = new Date(0);
  deliveryWorks = true;
  await outbox.processOutboxQueue();
  assert.equal(state.alertOutbox[0].status, 'SENT');
  assert.equal(state.alertOutbox[0].attempts, 2);
});
test('Serializable conflicts are retried with bounded attempts', async () => {
  const original = db.$transaction;
  let attempts = 0;
  try {
    db.$transaction = async fn => {
      if (++attempts < 3) throw Object.assign(Error('retry'), {
        code: 'P2034'
      });
      return fn(db);
    };
    assert.equal(await F.transact(async () => 42), 42);
    assert.equal(attempts, 3);
  } finally {
    db.$transaction = orig…5943 tokens truncated…234' })).status, 401);
});
