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
    db.$transaction = original;
  }
});
test('Reports use Karachi day boundaries and reject impossible dates', () => {
  assert.equal(time.dayKey(new Date('2026-10-07T20:00:00Z')), '2026-10-08');
  assert.equal(time.bounds('2026-10-08').start.toISOString(), '2026-10-07T19:00:00.000Z');
  assert.throws(() => time.rangeDates({
    range: 'custom',
    from: '2026-02-30',
    to: '2026-03-02'
  }));
});
test('Both assigned workers receive the frozen commission policy', async () => {
  state.user = [{
    id: 'w1',
    name: 'One',
    base_salary: 0,
    commission_rate: 90,
    flat_commission: 0
  }, {
    id: 'w2',
    name: 'Two',
    base_salary: 0,
    commission_rate: 90,
    flat_commission: 0
  }].map(u => ({
    ...u,
    is_active: true
  }));
  state.jobCard[0].status = 'COMPLETED';
  state.jobCard[0].completed_at = new Date('2026-10-08T00:00:00Z');
  state.jobCard[0].commission_snapshot = [{
    id: 'w1',
    rate: 10,
    share: 0.5,
    flat: 0
  }, {
    id: 'w2',
    rate: 10,
    share: 0.5,
    flat: 0
  }];
  const result = await require('../src/services/payroll.service').generateMonthlyPayroll('2026-10');
  assert.deepEqual(result.payroll.map(p => p.commissions_earned), [50, 50]);
});
test('Backup checksum verification rejects corruption and unsafe manifests', async () => {
  const fs = require('node:fs/promises'),
    os = require('node:os'),
    crypto = require('node:crypto');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dfpro-backup-test-'));
  const {
    verifyBackup,
    databaseEnv
  } = require('./backup-shop');
  try {
    await fs.writeFile(path.join(dir, 'database.dump'), 'fixture');
    const hash = crypto.createHash('sha256').update('fixture').digest('hex');
    await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({
      files: {
        'database.dump': hash
      }
    }));
    await verifyBackup(dir);
    await fs.writeFile(path.join(dir, 'database.dump'), 'corrupt');
    await assert.rejects(verifyBackup(dir), /checksum/);
    await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({
      files: {
        '../outside': 'x'
      }
    }));
    await assert.rejects(verifyBackup(dir), /Unsafe/);
    const env = databaseEnv('postgresql://user:p%40ss@localhost:5432/shop');
    assert.equal(env.PGPASSWORD, 'p@ss');
  } finally {
    await fs.rm(dir, {
      recursive: true,
      force: true
    });
  }
});
test('Remaining balance collection is idempotent and cannot overpay', async () => {
  await call(invoice.checkoutHandler, {
    job_card_id: 'job',
    collected_amount: 400
  });
  const id = state.invoice[0].id;
  await call(invoice.collectPaymentHandler, {
    collected_amount: 300
  }, {
    params: {
      id
    }
  });
  await call(invoice.collectPaymentHandler, {
    collected_amount: 300
  }, {
    params: {
      id
    }
  });
  assert.equal(state.invoice[0].paid_amount, 700);
  assert.equal(state.invoice[0].balance_due, 300);
  assert.equal(state.payment.length, 2);
  await assert.rejects(call(invoice.collectPaymentHandler, {
    collected_amount: 301
  }, {
    params: {
      id
    },
    headers: {
      'idempotency-key': 'different-request'
    }
  }), /exceeds/);
});
test('Original payment can be reversed only once, reopening its receivable', async () => {
  await call(invoice.checkoutHandler, {
    job_card_id: 'job',
    collected_amount: 1000
  });
  const id = state.invoice[0].id,
    payment = state.payment[0].id;
  const body = {
    payment_id: payment,
    admin_pin: '8765',
    reason: 'Wrong tender'
  };
  await call(invoice.reversePaymentHandler, body, {
    params: {
      id
    }
  });
  await call(invoice.reversePaymentHandler, body, {
    params: {
      id
    }
  });
  assert.equal(state.invoice[0].paid_amount, 0);
  assert.equal(state.invoice[0].balance_due, 1000);
  assert.equal(state.ledger[0].current_balance, 5000);
  assert.equal(state.payment.length, 2);
});
test('Refund retries preserve tender allocation and do not fabricate stock returns', async () => {
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
  const id = state.invoice[0].id;
  const refund = require('../src/controllers/physical-bays.controller').issueRefundHandler;
  const body = {
    amount: 700,
    admin_pin: '8765',
    reason: 'Customer credit'
  };
  await call(refund, body, {
    params: {
      id
    }
  });
  await call(refund, body, {
    params: {
      id
    }
  });
  assert.equal(state.invoice[0].paid_amount, 300);
  assert.equal(state.refund.length, 2);
  assert.equal(state.ledger[0].current_balance, 5000);
  assert.equal(state.bankAccount[0].current_balance, 5300);
  assert.equal(state.materialIssuance.length, 0);
  assert(state.refund.every(r => r.authorized_by_pin === 'APPROVED'));
  await assert.rejects(call(refund, {
    ...body,
    amount: 301
  }, {
    params: {
      id
    },
    headers: {
      'idempotency-key': 'next-refund-key'
    }
  }), /remaining/);
});
test('Drawer reconciliation includes expenses, deposits and every cash movement', async () => {
  state.registerSession = [{
    id: 'drawer',
    status: 'OPEN',
    starting_cash: 5000,
    ledger_cash_at_open: 5000
  }];
  await call(expense.createExpenseHandler, {
    amount: 200,
    category: 'Utilities',
    payment_method: 'CASH'
  });
  await call(deposit.createDepositHandler, {
    amount: 700,
    vehicle_id: 'car',
    payment_method: 'CASH'
  }, {
    headers: {
      'idempotency-key': 'deposit-request'
    }
  });
  const result = await call(require('../src/controllers/register.controller').getCurrentSessionHandler);
  assert.equal(result.body.data.expected_cash_in_drawer, 5500);
});
test('Accountant permissions allow routine work, block owner-only actions and apply overrides', async () => {
  const P = require('../src/services/permission.service');
  const accountant = {
    id: 'accountant',
    role: 'ACCOUNTANT',
    permissions: P.effectivePermissions({
      role: 'Accountant'
    })
  };
  assert(P.can(accountant, 'billing.manage'));
  assert(P.can(accountant, 'reports.read'));
  assert(!P.can(accountant, 'billing.refund'));
  assert.equal((await call(P.enforcePermissions, {}, {
    user: accountant,
    path: '/permissions',
    method: 'GET'
  })).status, 403);
  assert.equal((await call(P.enforcePermissions, {}, {
    user: accountant,
    path: '/invoices/x/refund',
    method: 'POST'
  })).status, 403);
  accountant.permissions['billing.refund'] = true;
  let passed = false;
  P.enforcePermissions({
    user: accountant,
    path: '/invoices/x/refund',
    method: 'POST'
  }, {}, () => passed = true);
  assert(passed);
  accountant.permissions['reports.read'] = false;
  assert.equal((await call(P.enforcePermissions, {}, {
    user: accountant,
    path: '/reports/summary',
    method: 'GET'
  })).status, 403);
  const approved = await P.approval({
    user: accountant,
    body: {}
  }, 'billing.discount');
  assert(approved.isValid);
  assert.equal(approved.source, 'SESSION');
});
test('Permission updates validate switches, preserve owner access and audit changes', async () => {
  const controller = require('../src/controllers/permission.controller');
  state.user.push({
    id: 'accountant',
    role: 'Accountant',
    is_active: true
  });
  await call(controller.updatePermissions, {
    permissions: {
      'billing.refund': true
    }
  }, {
    params: {
      id: 'accountant'
    }
  });
  assert.equal(state.user[1].permissions['billing.refund'], true);
  assert.equal(state.auditLog[0].action, 'PERMISSIONS_UPDATED');
  await assert.rejects(call(controller.updatePermissions, {
    permissions: {
      'billing.refund': 'false'
    }
  }, {
    params: {
      id: 'accountant'
    }
  }), /valid/);
  await assert.rejects(call(controller.updatePermissions, {
    permissions: {
      'reports.read': false
    }
  }, {
    params: {
      id: 'admin'
    }
  }), /Admin access/);
});
test('Unbilled service changes keep old prices/materials and reject stale edits or billed jobs', async () => {
  const handler = require('../src/controllers/job-services.controller').updateJobServices;
  state.service = [{
    id: 'wash',
    name: 'Wash',
    is_active: true,
    price: 1200
  }, {
    id: 'interior',
    name: 'Interior',
    is_active: true,
    price: 500
  }];
  state.jobCardService = [{
    id: 'line1',
    job_card_id: 'job',
    service_id: 'wash',
    price_charged: 1000
  }];
  state.jobCard[0].services_version = 0;
  state.jobCard[0].completed_at = new Date();
  state.materialIssuance.push({
    id: 'used',
    job_card_id: 'job',
    inventory_id: 'stock',
    quantity_issued: 30
  });
  const r = await call(handler, {
    service_ids: ['wash', 'interior'],
    expected_version: 0
  }, {
    params: {
      id: 'job'
    }
  });
  assert.equal(r.body.data.status, 'QUEUED');
  assert.equal(state.jobCardService.find(s => s.service_id === 'wash').price_charged, 1000);
  assert.equal(state.jobCardService.find(s => s.service_id === 'interior').price_charged, 500);
  assert.equal(state.materialIssuance.length, 1);
  await assert.rejects(call(handler, {
    service_ids: ['wash'],
    expected_version: 0
  }, {
    params: {
      id: 'job'
    }
  }), /another window/);
  await call(handler, {
    service_ids: ['interior'],
    expected_version: 1
  }, {
    params: {
      id: 'job'
    }
  });
  assert.equal(state.jobCardService.length, 1);
  state.invoice.push({
    id: 'closed',
    job_card_id: 'job'
  });
  await assert.rejects(call(handler, {
    service_ids: ['wash'],
    expected_version: 2
  }, {
    params: {
      id: 'job'
    }
  }), /locked/);
});
test('Direct ESC/POS jobs contain strong text and exactly one optional cut command', () => {
  const {
    buildEscPos,
    linesForDocument,
    isLocalHost
  } = require('../src/services/thermal-printer.service');
  const document = {
    invoice_number: 'INV-TEST',
    total_amount: 1000,
    paid_amount: 600,
    balance_due: 400,
    job_card: {
      vehicle: {
        registration_number: 'ABC123'
      },
      services: [{
        price_charged: 1000,
        service: {
          name: 'Full body wash'
        }
      }]
    },
    payments: [{
      payment_method: 'Cash',
      amount: 600
    }]
  };
  const packet = buildEscPos('INVOICE', document, {
    business_name: 'DF PRO'
  }, {
    paper_width: 80,
    auto_cut: true,
    cut_feed: 2
  });
  let cuts = 0;
  for (let i = 0; i < packet.length - 2; i++) if (packet[i] === 29 && packet[i + 1] === 86 && packet[i + 2] === 0) cuts++;
  assert.equal(cuts, 1);
  assert(packet.includes(Buffer.from([27, 69, 1])));
  assert(packet.toString().includes('Full body wash'));
  assert(!buildEscPos('INVOICE', document, {}, {
    paper_width: 58,
    auto_cut: false,
    cut_feed: 0
  }).includes(Buffer.from([29, 86, 0])));
  assert(isLocalHost('192.168.1.200'));
  assert(!isLocalHost('8.8.8.8'));
  assert(!isLocalHost('example.com'));
  assert(linesForDocument('INVOICE', document, {}, 32).every(line => line.length <= 32));
});
test('Direct print replay sends one TCP packet and settings validate the target', async () => {
  const net = require('node:net'),
    controller = require('../src/controllers/printer.controller');
  let packets = [];
  const server = net.createServer(socket => {
    const chunks = [];
    socket.on('data', chunk => chunks.push(chunk));
    socket.on('end', () => {
      packets.push(Buffer.concat(chunks));
      socket.end();
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    state.printerSetting = [{
      id: 'shop',
      mode: 'NETWORK',
      host: '127.0.0.1',
      port: server.address().port,
      paper_width: 80,
      auto_cut: true,
      cut_feed: 3
    }];
    await call(controller.printDocument, {
      kind: 'TICKET',
      document_id: 'job'
    });
    await call(controller.printDocument, {
      kind: 'TICKET',
      document_id: 'job'
    });
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(packets.length, 1);
    assert.equal(state.printerJob[0].status, 'SENT');
    await assert.rejects(call(controller.updateSettings, {
      mode: 'NETWORK',
      host: '8.8.8.8'
    }), /local/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
test('Uncertain native print delivery is recorded and replay never sends again', async () => {
  const controller = require('../src/controllers/printer.controller'),
    service = require('../src/services/thermal-printer.service');
  state.printerSetting = [{
    id: 'shop',
    mode: 'NETWORK',
    host: '127.0.0.1',
    port: 9100,
    paper_width: 80,
    auto_cut: true,
    cut_feed: 3
  }];
  const original = service.sendNetwork;
  let attempts = 0;
  try {
    service.sendNetwork = async () => {
      attempts++;
      throw Error('offline');
    };
    await assert.rejects(call(controller.printDocument, {
      kind: 'TICKET',
      document_id: 'job'
    }), /confirmed/);
    await assert.rejects(call(controller.printDocument, {
      kind: 'TICKET',
      document_id: 'job'
    }), /uncertain/);
    assert.equal(attempts, 1);
    assert.equal(state.printerJob[0].status, 'UNKNOWN');
  } finally {
    service.sendNetwork = original;
  }
});
test('HTTP API enforces Accountant permissions, including changes during an existing session', async () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api', require('../src/routes/api.routes'));
  app.use((e, req, res, next) => res.status(e.status || 500).json({
    message: e.message
  }));
  state.user.push({
    id: 'accountant',
    name: 'Accounts',
    role: 'Accountant',
    is_active: true,
    session_version: 0,
    permissions: {
      'reports.read': false
    }
  });
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const accountToken = security.generateToken({
      id: 'accountant',
      version: 0
    }),
    ownerToken = security.generateToken({
      id: 'admin',
      version: 0
    });
  const request = (url, token, method = 'GET', body) => fetch(base + url, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    ...(body ? {
      body: JSON.stringify(body)
    } : {})
  });
  try {
    assert.equal((await fetch(base + '/banks')).status, 401);
    assert.equal((await request('/reports/summary', accountToken)).status, 403);
    assert.equal((await request('/permissions', accountToken)).status, 403);
    assert.equal((await request('/invoices/x/refund', accountToken, 'POST', {
      amount: 100
    })).status, 403);
    assert.equal((await request('/settings', accountToken, 'PATCH', {
      key: 'ENABLE_SMS_GATEWAY',
      value: true
    })).status, 403);
    assert.equal((await request('/banks', accountToken)).status, 200);
    assert.equal((await request('/permissions/accountant', ownerToken, 'PATCH', {
      permissions: {
        'reports.read': true
      }
    })).status, 200);
    assert.equal(require('../src/services/permission.service').effectivePermissions(state.user[1])['reports.read'], true);
    assert.equal((await request('/reports/summary', accountToken)).status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
test('Owner cannot be demoted/deactivated as the last Admin, and compensation is validated without secret leaks', async () => {
  await assert.rejects(call(users.updateUserHandler, {
    role: 'Accountant'
  }, {
    params: {
      id: 'admin'
    }
  }), /active Admin/);
  await assert.rejects(call(users.toggleUserStatusHandler, {}, {
    params: {
      id: 'admin'
    }
  }), /active Admin/);
  await assert.rejects(call(require('../src/controllers/payroll.controller').updateStaffSalaryHandler, {
    base_salary: -100
  }, {
    params: {
      id: 'admin'
    }
  }), /valid amount/);
  await assert.rejects(call(require('../src/controllers/payroll.controller').updateStaffSalaryHandler, {
    commission_rate: 101
  }, {
    params: {
      id: 'admin'
    }
  }), /exceed/);
  const result = await call(require('../src/controllers/payroll.controller').updateStaffSalaryHandler, {
    base_salary: 1000,
    commission_rate: 10
  }, {
    params: {
      id: 'admin'
    }
  });
  assert.equal(result.body.data.base_salary, 1000);
  assert(!('password_hash' in result.body.data));
  assert(!('pin_code' in result.body.data));
  assert.equal(state.auditLog[0].action, 'STAFF_COMPENSATION_UPDATED');
});
test('Customer CRUD validates profiles, prevents duplicate plates and preserves transaction history', async () => {
  const controller = require('../src/controllers/master-data.controller');
  const created = await call(controller.saveCustomer, {
    registration_number: 'XYZ-123',
    customer_name: 'Driver'
  });
  const id = created.body.data.id;
  assert.equal(created.status, 201);
  await assert.rejects(call(controller.saveCustomer, {
    registration_number: 'xyz 123'
  }), /already exists/);
  await call(controller.saveCustomer, {
    customer_name: 'Updated',
    customer_phone: null
  }, {
    params: {
      id
    }
  });
  assert.equal(state.vehicle.find(v => v.id === id).customer_name, 'Updated');
  await assert.rejects(call(controller.saveCustomer, {
    registration_number: 'NEW-222'
  }, {
    params: {
      id
    }
  }), /cannot be changed/);
  state.customerDeposit.push({
    id: 'protected-advance',
    vehicle_id: id
  });
  await assert.rejects(call(controller.deleteCustomer, {}, {
    params: {
      id
    }
  }), /history must be retained/);
  state.customerDeposit = [];
  await call(controller.deleteCustomer, {}, {
    params: {
      id
    }
  });
  assert(!state.vehicle.some(v => v.id === id));
  assert(state.auditLog.some(a => a.action === 'CUSTOMER_DELETED'));
  const {
    requiredPermission
  } = require('../src/services/permission.service');
  assert.equal(requiredPermission({
    path: '/customers/x',
    method: 'DELETE',
    user: {
      id: 'admin'
    }
  }), 'customers.manage');
});
test('Inventory CRUD requires adjustment reasons, protects units/history and only removes empty unused items', async () => {
  const inventory = require('../src/controllers/inventory.controller');
  const controller = require('../src/controllers/master-data.controller');
  state.inventory = [{
    id: 'empty',
    item_name: 'Bottle',
    unit_type: 'ML',
    current_stock: 0,
    cost_per_unit: 1,
    low_stock_threshold: 1
  }];
  await assert.rejects(call(inventory.updateInventoryHandler, {
    current_stock: 5
  }, {
    params: {
      id: 'empty'
    }
  }), /reason/);
  await call(inventory.updateInventoryHandler, {
    item_name: 'New bottle',
    current_stock: 5,
    reason: 'Physical count'
  }, {
    params: {
      id: 'empty'
    }
  });
  await assert.rejects(call(inventory.updateInventoryHandler, {
    unit_type: 'Roll'
  }, {
    params: {
      id: 'empty'
    }
  }), /Units cannot change/);
  await assert.rejects(call(controller.deleteInventory, {}, {
    params: {
      id: 'empty'
    }
  }), /empty, unused/);
  await call(inventory.updateInventoryHandler, {
    current_stock: 0,
    reason: 'Verified empty'
  }, {
    params: {
      id: 'empty'
    }
  });
  state.materialIssuance.push({
    id: 'issue',
    inventory_id: 'empty'
  });
  await assert.rejects(call(controller.deleteInventory, {}, {
    params: {
      id: 'empty'
    }
  }), /history must be retained/);
  state.materialIssuance = [];
  state.serviceInventory.push({
    id: 'map',
    inventory_id: 'empty'
  });
  await assert.rejects(call(controller.deleteInventory, {}, {
    params: {
      id: 'empty'
    }
  }), /history must be retained/);
  state.serviceInventory = [];
  await call(controller.deleteInventory, {}, {
    params: {
      id: 'empty'
    }
  });
  assert.equal(state.inventory.length, 0);
  assert(state.auditLog.some(a => a.action === 'INVENTORY_DELETED'));
});

test('Only Admin and Accountant can log in; staff records cannot acquire login roles or credentials', async () => {
  for (const role of ['Worker','Manager','Cashier','Investor']) {
    state.user.push({ id: role, name: role, role, is_active: true, session_version: 0, password_hash: security.hashSecret('valid-password') });
    assert.equal((await call(users.loginHandler, { username: role, password: 'valid-password' })).status, 403);
    assert.equal((await call(auth.authenticateUser, {}, { headers: { authorization: 'Bearer ' + security.generateToken({ id: role, version: 0 }) } })).status, 403);
    assert.equal((await call(users.createUserHandler, { name: 'New ' + role, role, password: 'valid-password', pin_code: '1234' })).status, 400);
  }
  const result = await call(users.createUserHandler, { name: 'Floor technician', role: 'Worker', base_salary: 30000 }, { staffRecord: true });
  assert.equal(result.status, 201);
  const worker = state.user.find(u => u.name === 'Floor technician');
  assert.equal(worker.password_hash, null);
  assert.equal(worker.pin_code, '');
  assert.equal((await call(users.resetPasswordHandler, { new_password: 'valid-password' }, { params: { id: worker.id } })).status, 400);
  const account = await call(users.createUserHandler, { name: 'Bookkeeper', role: 'Accountant', password: 'valid-password' });
  assert.equal(account.status, 201);
  assert.equal((await call(users.loginHandler, { username: 'Bookkeeper', password: 'valid-password' })).status, 200);
});
