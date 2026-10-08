/* Browser-contract checks with isolated fixtures. No database, hardware or real money is used. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {
  chromium
} = require(require.resolve('playwright', {
  paths: [path.join(__dirname, '../client')]
}));
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:3000';
const screenshots = process.env.UI_SCREENSHOT_DIR || path.join(__dirname, '../docs/ui');
const services = [{
  id: 's1',
  name: 'Express Foam Wash',
  category: 'Wash',
  price: 1000,
  description: 'Exterior foam wash, wheels and microfiber dry'
}, {
  id: 's2',
  name: 'Premium Wash & Vacuum',
  category: 'Wash',
  price: 1500,
  description: 'Complete exterior wash with interior vacuum'
}, {
  id: 's3',
  name: 'Interior Deep Clean',
  category: 'Detailing',
  price: 4500,
  description: 'Seats, carpets, dashboard and cabin detailing'
}, {
  id: 's4',
  name: 'Ceramic Coating',
  category: 'Detailing',
  price: 18000,
  description: 'Paint preparation and protective ceramic coating'
}, {
  id: 's5',
  name: 'PPF Installation',
  category: 'PPF',
  price: 35000,
  description: 'Protective film installation on selected panels'
}];
services.forEach(s => s.is_active = true);
const {
  effectivePermissions,
  CATALOG
} = require('../src/services/permission.service');
let accountantGrants = effectivePermissions({
  role: 'Accountant'
});
const job = (id, plate, service = services[0]) => ({
  id,
  vehicle_id: 'v-' + id,
  ticket_number: 'CW-20261008-' + id,
  customer_name: 'Test Customer',
  status: 'QUEUED',
  started_at: new Date(Date.now() - 17 * 60000).toISOString(),
  vehicle: {
    id: 'v-' + id,
    registration_number: plate,
    customer_name: 'Test Customer',
    customer_phone: '03001234567',
    make: 'Honda',
    model: 'Civic'
  },
  services: [{
    id: id + '-service',
    service,
    price_charged: service.price
  }],
  media: []
});
const active = job('1001', 'ABC-123'),
  detail = job('1002', 'LEA-456', services[3]);
const ready = job('1003', 'XYZ-789', services[1]);
ready.status = 'READY_FOR_BILLING';
active.status = 'IN_PROGRESS';
detail.status = 'IN_PROGRESS';
ready.assigned_location = 'JACK_1';
ready.completed_at = new Date().toISOString();
const bayData = {
  status: 'success',
  physical_bays: {
    jack_1: {
      name: 'Jack 1',
      team: 'Wash Team 1',
      is_occupied: true,
      current_job: active
    },
    jack_2: {
      name: 'Jack 2',
      team: 'Wash Team 2',
      is_occupied: false
    },
    detailing_bay_1: {
      name: 'Detailing Bay 1',
      team: 'Detailing Team',
      is_occupied: true,
      current_job: detail
    },
    detailing_bay_2: {
      name: 'Detailing Bay 2',
      team: 'Detailing Team',
      is_occupied: false
    }
  },
  queue: [job('1004', 'PES-321'), job('1005', 'ISB-654', services[1])],
  ready_for_billing: [ready]
};
const recent = [{
  id: 'invoice-1',
  invoice_number: 'INV-001',
  payment_method: 'CASH',
  total_amount: 1000,
  job_card: active
}];
const requests = [],
  errors = [],
  checks = [];
let failServices = false,
  failServer = false,
  fixtureRole = "ADMIN";
async function fixtures(route) {
  const request = route.request(),
    url = new URL(request.url()),
    endpoint = url.pathname;
  const body = request.postDataJSON();
  requests.push({
    query: Object.fromEntries(url.searchParams),
    endpoint,
    method: request.method(),
    body
  });
  let data = [],
    result,
    status = 200;
  if (failServices && endpoint === '/api/services' || failServer) {
    status = 503;
    result = {
      status: 'error',
      message: 'Test server unavailable'
    };
  } else if (endpoint === '/api/auth/me') result = {
    user: {
      id: 'fixture-user',
      name: 'Shop Owner',
      role: fixtureRole,
      permissions: fixtureRole === 'ACCOUNTANT' ? accountantGrants : effectivePermissions({
        role: fixtureRole
      })
    }
  };else if (endpoint === '/api/printer/settings') data = {
    mode: 'BROWSER',
    paper_width: 80,
    auto_cut: false,
    cut_feed: 3
  };else if (endpoint === '/api/permissions') {
    data = {
      catalog: CATALOG,
      users: [{
        id: 'accountant',
        name: 'Accountant',
        role: 'Accountant',
        permissions: accountantGrants
      }]
    };
  } else if (endpoint === '/api/permissions/accountant') {
    accountantGrants = {
      ...accountantGrants,
      ...body.permissions
    };
  } else if (request.method() === 'PUT' && /^\/api\/job-cards\/[^/]+\/services$/.test(endpoint)) {
    const id = endpoint.split('/')[3];
    const target = [...bayData.queue, ...bayData.ready_for_billing].find(j => j.id === id);
    target.services = body.service_ids.map(id => ({
      service_id: id,
      service: services.find(s => s.id === id),
      price_charged: services.find(s => s.id === id).price
    }));
    target.services_version = (target.services_version || 0) + 1;
    data = target;
  } else if (endpoint === '/api/banks') data = {
    accounts: [{
      id: 'bank-1',
      bank_name: 'Fixture Bank',
      account_title: 'DF PRO',
      is_active: true,
      current_balance: 32000
    }]
  };else if (endpoint === '/api/services') data = services;else if (endpoint === '/api/bays/live-status') result = bayData;else if (endpoint === '/api/ledger') data = [{
    account_type: 'Cash_Drawer',
    current_balance: 14500
  }, {
    account_type: 'Main_Bank',
    current_balance: 32000
  }];else if (endpoint === '/api/register/current') data = {
    is_open: true,
    starting_cash: 5000,
    expected_cash_in_drawer: 14500
  };else if (endpoint.startsWith('/api/vehicles/')) {
    status = 404;
    result = {
      status: 'error'
    };
  } else if (endpoint === '/api/intake') {
    const created = job('2001', body.registration_number);
    created.customer_name = body.customer_name;
    created.vehicle.customer_phone = body.customer_phone;
    created.services = body.services.map(item => ({
      id: item.service_id,
      service: services.find(s => s.id === item.service_id),
      price_charged: item.price
    }));
    data = {
      job_card: created,
      vehicle: created.vehicle
    };
  } else if (endpoint === '/api/invoices') data = recent;else if (endpoint === '/api/deposits/active') data = [{
    id: 'deposit-1',
    amount: 300,
    customer_name: 'Test Customer',
    payment_method: 'CASH',
    created_at: new Date().toISOString()
  }];else if (endpoint === '/api/invoices/checkout') data = {
    invoice: {
      id: 'invoice-2',
      invoice_number: 'INV-002',
      total_amount: 1500,
      paid_amount: 1500,
      discount_amount: 0,
      balance_due: 0,
      job_card: ready
    },
    status: 'PAID',
    balance_due: 0,
    deposits_applied: 300,
    subtotal: 1500,
    final_total: 1500,
    payments_collected: 1200,
    payments: body.payments,
    applied_deposits: [{
      id: 'deposit-1',
      amount: 300
    }]
  };else if (endpoint === '/api/leaderboard') data = [{
    id: 'worker-1',
    name: 'Test Technician',
    commission_rate: 5,
    cars_completed: 6,
    estimated_commission: 450
  }];else if (endpoint === '/api/dashboard/live') data = {
    today_summary: {
      gross_revenue: 12500,
      net_profit: 8300,
      total_expenses: 4200,
      cash_revenue: 8000,
      bank_revenue: 4500,
      cars_washed_today: 9,
      active_in_bay: 2,
      queued_in_intake: 2
    },
    vault_balances: {
      cash_drawer: 14500,
      main_bank: 32000
    },
    recent_invoices: recent,
    bays_breakdown: {
      jack_1: 4,
      jack_2: 3,
      detailing_center: 2
    },
    live_bays: {
      in_progress: [active, detail].map(j => ({
        job_card_id: j.id,
        plate: j.vehicle.registration_number,
        make_model: 'Honda Civic',
        worker: 'Test Technician',
        services: j.services.map(s => s.service.name).join(', ')
      })),
      queued: []
    }
  };else if (endpoint === '/api/inventory') data = [{
    id: 'stock-1',
    item_name: 'Ceramic Coating',
    current_stock: 850,
    cost_per_unit: 20,
    unit_type: 'ML',
    low_stock_threshold: 100,
    is_low_stock: false
  }];else if (endpoint === '/api/branding') data = {
    business_name: 'DF PRO Test Shop',
    invoice_template: 'BOLD_TABLE',
    show_business_name: true
  };else if (endpoint === '/api/customers') data = {
    customers: [{
      id: 'c1',
      registration_number: 'LOY-555',
      customer_name: 'Fixture Driver',
      customer_phone: '03001234567',
      visits: 8,
      is_loyal: true,
      total_spent: 12000,
      make: 'Honda',
      model: 'Civic',
      recent_services: []
    }],
    summary: {
      total_customers: 1,
      loyal_customers: 1,
      repeat_rate_percent: 100,
      total_lifetime_revenue: 12000
    }
  };else if (endpoint === '/api/reports/summary') data = {
    summary: {
      gross_revenue: 12000,
      total_invoices: 4,
      cash_revenue: 8000,
      bank_revenue: 4000,
      average_ticket: 3000,
      net_operating_profit: 9000,
      total_expenses: 3000
    },
    top_services: [],
    top_makes: [],
    timeline: []
  };else if (endpoint === '/api/settings') data = {
    ENABLE_TELEGRAM_ALERTS: true,
    ENABLE_SMS_GATEWAY: false,
    ENABLE_CAMERA_ANPR: false
  };else if (endpoint === '/api/financials/payroll') data = {
    summary: {},
    staff: []
  };else if (endpoint === '/api/financials/dividends') data = {
    partners: [],
    financial_summary: {},
    cogs_breakdown: []
  };
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(result || {
      status: 'success',
      data
    })
  });
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log('PASS', name);
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, 'Page must not overflow horizontally');
}
(async () => {
  fs.mkdirSync(screenshots, {
    recursive: true
  });
  const execPath = process.env.CHROMIUM_EXECUTABLE || 'C:\\Users\\HP\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe';
  const browser = await chromium.launch({
    headless: true,
    ...(fs.existsSync(execPath) ? {
      executablePath: execPath,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    } : {})
  });
  try {
    const context = await browser.newContext({
      viewport: {
        width: 1366,
        height: 768
      }
    });
    await context.route('**/api/**', fixtures);
    const page = await context.newPage();
    page.on('pageerror', error => (errors.push(error.message), console.error('PAGE ERROR', error.message)));
    await context.addInitScript(() => localStorage.setItem('carwash_auth_token', 'fixture-token'));
    await page.goto(base);
    await page.getByRole('button', {
      name: 'Express Foam Wash'
    }).waitFor();
    await check('Desktop intake and real service selection', async () => {
      await noOverflow(page);
      await page.getByLabel('Vehicle plate').fill('PES-101');
      await page.getByLabel('Customer name').fill('Test Driver');
      await page.getByLabel('Phone number').fill('03001234567');
      await page.getByRole('button', {
        name: 'Express Foam Wash'
      }).click();
      await page.getByRole('button', {
        name: 'Premium Wash & Vacuum'
      }).click();
      assert.match(await page.locator('.summary-total').innerText(), /2,500/);
      await page.screenshot({
        path: path.join(screenshots, 'new-vehicle-desktop.png')
      });
    });
    await check('Search, categories and removable summary lines', async () => {
      await page.getByRole('button', {
        name: 'PPF',
        exact: true
      }).click();
      assert.equal(await page.locator('.service-option').count(), 1);
      await page.getByRole('button', {
        name: 'All services',
        exact: true
      }).click();
      await page.getByLabel('Search services').fill('ceramic');
      assert.equal(await page.locator('.service-option').count(), 1);
      await page.getByLabel('Search services').fill('');
      await page.getByRole('button', {
        name: 'Remove Premium Wash & Vacuum'
      }).click();
      assert.match(await page.locator('.summary-total').innerText(), /1,000/);
    });
    await check('Ticket creation uses nested backend response and print preview', async () => {
      await page.getByRole('button', {
        name: 'Create work ticket'
      }).click();
      await page.getByRole('dialog').waitFor();
      assert.match(await page.locator('#printable-ticket').innerText(), /PES-101/);
      assert.equal(requests.find(r => r.endpoint === '/api/intake').body.services[0].service_id, 's1');
      const popupPromise = page.waitForEvent('popup');
      await page.getByRole('button', {
        name: 'Print ticket',
        exact: true
      }).click();
      const popup = await popupPromise;
      await popup.waitForLoadState();
      assert.match(await popup.locator('body').innerText(), /PES-101/);
      await popup.close();
      await page.getByRole('button', {
        name: 'View workshop'
      }).click();
      await page.getByRole('heading', {
        name: 'Work areas'
      }).waitFor();
      assert.equal(await page.locator('.bay-card').count(), 4);
      await noOverflow(page);
      await page.screenshot({
        path: path.join(screenshots, 'workshop-desktop.png')
      });
    });
    await check('Bay dispatch and completion retain API contracts', async () => {
      assert.equal(await page.getByLabel('Assign bay for PES-321').count(), 0);
      await page.locator('tr').filter({
        hasText: 'PES-321'
      }).getByRole('button', {
        name: 'Jack 2',
        exact: true
      }).click();
      await page.getByRole('button', {
        name: 'Confirm & Start Work'
      }).click();
      await page.waitForTimeout(100);
      assert.equal(requests.find(r => r.endpoint.endsWith('/1004/start')).body.location, 'JACK_2');
      await page.getByRole('button', {
        name: 'Mark work complete'
      }).first().click();
      assert(requests.some(r => r.endpoint.endsWith('/1001/complete')));
    });
    await check('Billing keeps receipt open after split payment and deposit', async () => {
      await page.getByRole('button', {
        name: 'Billing & invoices'
      }).click();
      await page.getByRole('button', {
        name: 'Collect payment',
        exact: true
      }).click();
      await page.getByText('Rs. 300.00 advance applied', {
        exact: false
      }).waitFor();
      assert(await page.getByRole('button', {
        name: 'Confirm payment',
        exact: true
      }).isVisible());
      await page.getByRole('button', {
        name: 'Enable Split Payment'
      }).click();
      await page.getByRole('button', {
        name: 'Confirm payment',
        exact: true
      }).click();
      await page.locator('#printable-receipt').waitFor();
      const checkout = requests.find(r => r.endpoint === '/api/invoices/checkout').body;
      assert.deepEqual(checkout.payments, [{
        payment_method: 'CASH',
        amount: 600
      }, {
        payment_method: 'BANK',
        amount: 600,
        bank_account_id: 'bank-1'
      }]);
      assert.deepEqual(checkout.applied_deposit_ids, ['deposit-1']);
      await page.getByRole('button', {
        name: 'Done',
        exact: true
      }).click();
      await page.screenshot({
        path: path.join(screenshots, 'billing-desktop.png')
      });
    });
    await check('Partner dashboard, staff, management and settings render', async () => {
      await page.getByRole('button', {
        name: 'Business overview'
      }).click();
      await page.getByText('12,500.00', {
        exact: false
      }).first().waitFor({
        timeout: 5000
      });
      await noOverflow(page);
      await page.getByRole('button', {
        name: /Live Sync/
      }).click();
      await page.screenshot({
        path: path.join(screenshots, 'overview-desktop.png')
      });
      await page.getByRole('button', {
        name: 'Staff performance'
      }).click();
      await page.getByRole('heading', {
        name: /Test Technician/
      }).waitFor();
      await page.getByRole('button', {
        name: 'Inventory & finance',
        exact: true
      }).click();
      if (await page.getByPlaceholder('Enter management PIN').count()) {
        await page.getByPlaceholder('Enter management PIN').fill('1234');
        await page.getByRole('button', {
          name: /Unlock Admin Panel/
        }).click();
      }
      await page.getByText('Ceramic Coating', {
        exact: true
      }).first().waitFor();
      await noOverflow(page);
      await page.getByRole('button', {
        name: 'Settings',
        exact: true
      }).click();
      await page.getByRole('button', {
        name: 'Connections',
        exact: true
      }).click();
      await page.getByLabel('Customer SMS receipts').check();
      assert(requests.some(r => r.endpoint === '/api/settings' && r.method === 'PATCH' && r.body.key === 'ENABLE_SMS_GATEWAY'));
    });
    await check('Six invoice and five ticket themes, blue print buttons and editable settings', async () => {
      await page.getByRole('button', {
        name: 'Printing & logo',
        exact: true
      }).click();
      for (const theme of ['BOLD_TABLE', 'BOLD_BOXED', 'BOLD_COMPACT', 'STUDIO_SIGNED', 'SERVICE_LEDGER', 'MINIMAL_RULED']) {
        await page.getByLabel('Invoice design', {
          exact: true
        }).selectOption(theme);
        const receipt = page.locator('#settings-print-preview');
        assert.equal(await receipt.locator('table').count(), 1);
        assert.equal(await receipt.getAttribute('data-receipt-theme'), theme);
        assert.equal(await receipt.evaluate(e => getComputedStyle(e).fontFamily), 'Arial, Helvetica, sans-serif');
        await receipt.screenshot({
          path: path.join(screenshots, theme.toLowerCase() + '.png')
        });
      }
      await page.getByRole('button', {
        name: 'Ticket preview',
        exact: true
      }).click();
      for (const theme of ['WORKSHOP_CHECKLIST', 'SERVICE_CARD', 'COMPACT_DISPATCH', 'STANDARD_BOX', 'BOLD_TOKEN']) {
        await page.getByLabel('Ticket design', {
          exact: true
        }).selectOption(theme);
        assert.equal(await page.locator('#settings-print-preview').getAttribute('data-ticket-theme'), theme);
        assert.equal(await page.locator('.ticket-check-row').count(), 2);
      }
      await page.getByRole('button', {
        name: 'Save print settings'
      }).click();
      await page.getByText('Settings saved.', {
        exact: true
      }).waitFor();
      assert(requests.some(r => r.endpoint === '/api/branding' && r.method === 'PATCH' && r.body.invoice_template === 'MINIMAL_RULED'));
      const printButton = page.getByRole('button', {
        name: 'Print sample',
        exact: true
      });
      assert.equal(await printButton.evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(37, 99, 235)');
      const popupPromise = page.waitForEvent('popup');
      await printButton.click();
      const popup = await popupPromise;
      await popup.waitForLoadState();
      assert.equal(await popup.locator('.ticket-sheet').count(), 1);
      await popup.close();
      await page.getByLabel('Print method', {
        exact: true
      }).selectOption('NETWORK');
      await page.getByLabel('Auto-cut after each print').check();
      assert(await page.getByLabel('Auto-cut after each print').isChecked());
      await page.getByLabel('Print method', {
        exact: true
      }).selectOption('BROWSER');
      assert(await page.getByLabel('Auto-cut after each print').isDisabled());
    });
    await check('Reports and loyalty directory work and reuse customer details', async () => {
      await page.getByRole('button', {
        name: 'Reports',
        exact: true
      }).click();
      await page.getByRole('heading', {
        name: 'Sales reports'
      }).waitFor();
      await page.getByRole('button', {
        name: 'Today',
        exact: true
      }).click();
      await page.waitForTimeout(150);
      assert(requests.some(r => r.endpoint === '/api/reports/summary' && r.query.range === 'today'));
      await page.screenshot({
        path: path.join(screenshots, 'reports-desktop.png')
      });
      await page.getByRole('button', {
        name: 'Loyal Customers',
        exact: true
      }).click();
      await page.getByText('LOY-555', {
        exact: true
      }).waitFor();
      await page.screenshot({
        path: path.join(screenshots, 'loyal-customers-desktop.png')
      });
      await page.getByRole('button', {
        name: 'New Ticket'
      }).click();
      assert.equal(await page.getByLabel('Vehicle plate').inputValue(), 'LOY-555');
      assert.equal(await page.getByLabel('Customer name').inputValue(), 'Fixture Driver');
      assert.equal(await page.locator('.sidebar-bottom').count(), 0);
      assert.equal(await page.locator('.app-topbar').count(), 0);
      await page.setViewportSize({
        width: 1920,
        height: 1080
      });
      await noOverflow(page);
      await page.screenshot({
        path: path.join(screenshots, 'new-vehicle-24inch.png')
      });
      await page.getByRole('button', {
        name: 'Workshop',
        exact: true
      }).click();
      assert.equal(await page.locator('#executive-kpi-bar').count(), 0);
    });
    await check('Tablet and phone layouts, accessible navigation', async () => {
      await page.setViewportSize({
        width: 1024,
        height: 768
      });
      await page.goto(base + '/#intake');
      await page.getByRole('button', {
        name: 'Express Foam Wash'
      }).waitFor();
      await noOverflow(page);
      await page.screenshot({
        path: path.join(screenshots, 'new-vehicle-tablet.png')
      });
      await page.setViewportSize({
        width: 390,
        height: 844
      });
      await page.waitForTimeout(250);
      await noOverflow(page);
      await page.evaluate(() => {
        document.activeElement?.blur();
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(250);
      await page.screenshot({
        path: path.join(screenshots, 'new-vehicle-mobile.png'),
        fullPage: true
      });
      await page.getByRole('button', {
        name: 'Open navigation'
      }).click();
      await page.getByRole('button', {
        name: 'Workshop',
        exact: true
      }).click();
      await noOverflow(page);
      assert.equal(await page.locator('.app-sidebar.is-open').count(), 0);
      await page.evaluate(() => {
        document.activeElement?.blur();
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(250);
      await page.screenshot({
        path: path.join(screenshots, 'workshop-mobile.png'),
        fullPage: true
      });
    });
    await check('Worker navigation and role-scoped financial requests', async () => {
      await page.setViewportSize({
        width: 1366,
        height: 768
      });
      const from = requests.length;
      fixtureRole = 'WORKER';
      await page.reload();
      await page.waitForTimeout(350);
      assert.equal(await page.getByRole('button', {
        name: 'Business overview'
      }).count(), 0);
      assert.equal(await page.getByRole('button', {
        name: 'Billing & invoices'
      }).count(), 0);
      assert.equal(requests.slice(from).filter(r => ['/api/ledger', '/api/register/current'].includes(r.endpoint)).length, 0);
      fixtureRole = 'ADMIN';
      await page.reload();
    });
    await check('Unbilled service editor adds/removes services and updates a work ticket', async () => {
      await page.goto(base + '/#bays');
      await page.locator('tr').filter({
        hasText: 'PES-321'
      }).waitFor();
      await page.locator('tr').filter({
        hasText: 'PES-321'
      }).getByRole('button', {
        name: 'Edit services',
        exact: true
      }).click();
      const modal = page.getByRole('dialog', {
        name: 'Edit services'
      });
      await modal.getByRole('button', {
        name: /Interior Deep Clean/
      }).click();
      await modal.getByRole('button', {
        name: /Express Foam Wash/
      }).click();
      await modal.getByRole('button', {
        name: 'Save services',
        exact: true
      }).click();
      await page.waitForTimeout(150);
      const mutation = requests.find(r => r.method === 'PUT' && r.endpoint === '/api/job-cards/1004/services');
      assert.deepEqual(mutation.body.service_ids, ['s3']);
      assert.equal(mutation.body.expected_version, 0);
    });
    await check('Accountant sees permitted tabs without repeated PINs; permissions are editable', async () => {
      await page.goto(base + '/#settings');
      await page.getByRole('button', {
        name: 'Permissions',
        exact: true
      }).click();
      await page.getByLabel('Reports', {
        exact: true
      }).uncheck();
      await page.getByRole('button', {
        name: 'Save permissions',
        exact: true
      }).click();
      await page.getByText('Permissions saved.', {
        exact: true
      }).waitFor();
      fixtureRole = 'ACCOUNTANT';
      await page.reload();
      await page.waitForTimeout(250);
      assert.equal(await page.getByRole('button', {
        name: 'Reports',
        exact: true
      }).count(), 0);
      assert.equal(await page.getByRole('button', {
        name: 'Permissions',
        exact: true
      }).count(), 0);
      await page.getByRole('button', {
        name: 'Business overview',
        exact: true
      }).click();
      await page.getByText('12,500.00', {
        exact: false
      }).first().waitFor();
      await page.getByRole('button', {
        name: 'Inventory & finance',
        exact: true
      }).click();
      assert.equal(await page.getByPlaceholder('Enter management PIN').count(), 0);
      assert.equal(await page.getByRole('button', {
        name: 'Partner Profit Split',
        exact: true
      }).count(), 0);
      fixtureRole = 'ADMIN';
      await page.reload();
    });
    await check('Service/server failures are visible and never invent catalogue items', async () => {
      failServices = true;
      await page.goto(base + '/#intake');
      await page.getByText('Services could not be loaded.', {
        exact: false
      }).waitFor();
      assert.equal(await page.locator('.service-option').count(), 0);
      assert(await page.getByRole('button', {
        name: 'Create work ticket'
      }).isDisabled());
      failServices = false;
      await page.getByRole('button', {
        name: 'Try again',
        exact: true
      }).click();
      await page.getByRole('button', {
        name: 'Express Foam Wash'
      }).waitFor();
      await page.locator('.workspace-summary').getByText('Rs. 14,500.00', {
        exact: true
      }).waitFor();
      failServer = true;
      await page.getByRole('button', {
        name: 'Refresh shop data'
      }).click();
      await page.getByText('Unable to reach the shop server.', {
        exact: false
      }).waitFor();
      assert.match(await page.locator('.workspace-summary').innerText(), /14,500/);
    });
    assert.deepEqual(errors, [], 'No browser runtime exceptions');
    console.log(`PASS ${checks.length} browser scenarios; no page errors. Fixtures only, not backend accounting verification.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
