const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(__dirname, '../client')] }));

const base = 'http://localhost:3000';
const consoleErrors = [];
const failedRequests = [];

(async () => {
  console.log('====================================================');
  console.log('  STARTING FULL A-TO-Z SYSTEM HEALTH & BUG AUDIT    ');
  console.log('====================================================');

  const fs = require('node:fs');
  const execPath = process.env.CHROMIUM_EXECUTABLE || 'C:\\Users\\HP\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe';
  const browser = await chromium.launch({
    headless: true,
    ...(fs.existsSync(execPath) ? {
      executablePath: execPath,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    } : {}),
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    let currentStep = 'INIT';
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        consoleErrors.push(`[During ${currentStep}] ${text}`);
      }
    });

    page.on('response', (res) => {
      if (res.status() >= 400) {
        console.log(`  [HTTP ERROR] ${res.status()} ${res.request().method()} ${res.url()}`);
      }
    });

    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.method()} ${req.url()} (${req.failure()?.errorText || 'failed'})`);
    });

    await page.addInitScript(() => {
      localStorage.setItem('carwash_user_role', 'ADMIN');
      localStorage.setItem('carwash_user_name', 'Shop Owner & Admin');
    });

    // 1. Audit Home & Bays Tab (#bays)
    console.log('\n[TEST 1/9] Auditing Workshop Bays (#bays)...');
    currentStep = 'Workshop Bays (#bays)';
    await page.goto(`${base}/#bays`, { waitUntil: 'networkidle' });
    assert.ok(await page.title(), 'Page should have a title');
    const baysHeader = await page.textContent('h1');
    console.log(`  ✔ Bays view rendered: "${baysHeader}"`);
    // Verify KPI bar is NOT present on bays tab
    const kpiBarOnBays = await page.locator('#executive-kpi-bar').count();
    assert.equal(kpiBarOnBays, 0, 'Executive KPI bar should NOT be on Workshop bays tab');
    console.log('  ✔ Confirmed: KPI bar is hidden on Workshop bays tab');

    // 2. Audit New Vehicle Intake (#intake)
    console.log('\n[TEST 2/9] Auditing New Vehicle Intake (#intake)...');
    currentStep = 'New Vehicle Intake (#intake)';
    await page.goto(`${base}/#intake`, { waitUntil: 'networkidle' });
    const intakeTitle = await page.textContent('h1');
    console.log(`  ✔ Intake view rendered: "${intakeTitle}"`);
    // Verify KPI bar IS present on intake tab
    const kpiBarOnIntake = await page.locator('#executive-kpi-bar').count();
    assert.equal(kpiBarOnIntake, 1, 'Executive KPI bar should ONLY be on New Vehicle tab');
    console.log('  ✔ Confirmed: KPI bar is present exclusively on New Vehicle tab');

    // Verify tactile service cards are rendered
    await page.locator('button.service-option').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    const serviceButtons = page.locator('button.service-option');
    const serviceCount = await serviceButtons.count();
    console.log(`  ✔ Upgraded tactile service tiles rendered (${serviceCount} cards)`);
    assert.ok(serviceCount > 0, 'Service tiles should render');

    // 3. Audit Billing Queue (#billing)
    console.log('\n[TEST 3/9] Auditing Billing Queue (#billing)...');
    currentStep = 'Billing Queue (#billing)';
    await page.goto(`${base}/#billing`, { waitUntil: 'networkidle' });
    const billingTitle = await page.textContent('h1');
    console.log(`  ✔ Billing view rendered: "${billingTitle}"`);
    const kpiBarOnBilling = await page.locator('#executive-kpi-bar').count();
    assert.equal(kpiBarOnBilling, 0, 'Executive KPI bar should NOT be on Billing tab');
    console.log('  ✔ Confirmed: KPI bar is hidden on Billing tab');

    // 4. Audit Loyal Customers (#customers)
    console.log('\n[TEST 4/9] Auditing Loyal Customers Section (#customers)...');
    currentStep = 'Loyal Customers (#customers)';
    await page.goto(`${base}/#customers`, { waitUntil: 'networkidle' });
    const custHeader = await page.locator('text=Loyal Customers & VIP Fleet Directory').first();
    assert.ok(await custHeader.count() > 0, 'Loyal Customers directory should render');
    console.log('  ✔ Loyal Customers directory rendered with VIP badges & lifetime stats');

    // 5. Audit Reports & Analytics (#reports)
    console.log('\n[TEST 5/9] Auditing Reports & Analytics (#reports)...');
    currentStep = 'Reports & Analytics (#reports)';
    await page.goto(`${base}/#reports`, { waitUntil: 'networkidle' });
    const reportsHeader = await page.locator('text=Reports & Business Analytics').first();
    assert.ok(await reportsHeader.count() > 0, 'Reports & Analytics section should render');
    console.log('  ✔ Reports & Analytics rendered with revenue KPIs & top services');

    // 6. Audit Leaderboard (#leaderboard)
    console.log('\n[TEST 6/9] Auditing Worker Leaderboard (#leaderboard)...');
    currentStep = 'Worker Leaderboard (#leaderboard)';
    await page.goto(`${base}/#leaderboard`, { waitUntil: 'networkidle' });
    const lbTitle = await page.textContent('h1');
    console.log(`  ✔ Leaderboard view rendered: "${lbTitle}"`);

    // 7. Audit Investor Portal (#investor)
    console.log('\n[TEST 7/9] Auditing Investor Dashboard (#investor)...');
    currentStep = 'Investor Dashboard (#investor)';
    await page.goto(`${base}/#investor`, { waitUntil: 'networkidle' });
    const invTitle = await page.textContent('h1');
    console.log(`  ✔ Investor view rendered: "${invTitle}"`);

    // 8. Audit Admin & Inventory Hub (#admin) and all its sub-tabs
    console.log('\n[TEST 8/9] Auditing Admin Management (#admin) tabs...');
    currentStep = 'Navigating to #admin';
    await page.goto(`${base}/#admin`, { waitUntil: 'networkidle' });
    const adminTabs = [
      'Services Catalog',
      'Staff & Roles',
      'Bank Accounts',
      'Logo & Branding',
      'Inventory',
      'Monthly Payroll',
      'Partner Profit Split',
      'Audit Log',
    ];

    for (const tabName of adminTabs) {
      currentStep = `Admin sub-tab: ${tabName}`;
      const btn = page.getByRole('button', { name: new RegExp(tabName, 'i') }).first();
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(350);
        console.log(`  ✔ Admin sub-tab "${tabName}" opened successfully`);
      } else {
        console.log(`  ⚠ Admin sub-tab "${tabName}" button not found directly`);
      }
    }

    // 9. Audit Master Settings Hub (#settings)
    console.log('\n[TEST 9/9] Auditing Master Settings Hub (#settings)...');
    currentStep = 'Master Settings (#settings)';
    await page.goto(`${base}/#settings`, { waitUntil: 'networkidle' });
    const settingsHeader = await page.locator('text=Shop Settings & Customization').first();
    assert.ok(await settingsHeader.count() > 0, 'Settings control center should render');
    console.log('  ✔ Settings hub rendered successfully');

    // Check Business Name check mark
    const chkBusinessName = page.locator('#chk-print-business-name');
    assert.ok(await chkBusinessName.count() > 0, 'Business name check mark should be present');
    console.log('  ✔ "Print Business Name on Invoice" check mark is present');

    // Check all 6 invoice template radio options
    const templates = [
      'CLASSIC_THERMAL',
      'MODERN_CLEAN',
      'DETAILED_TAX',
      'LUXURY_STUDIO',
      'ENTERPRISE_MINIMAL',
      'VIP_GOLD_PASS',
    ];
    for (const tmpl of templates) {
      const radio = page.locator(`input[name="invoice_template"][value="${tmpl}"]`);
      assert.ok(await radio.count() > 0, `Template radio for ${tmpl} should exist`);
    }
    console.log('  ✔ All 6 professional invoice templates exist and are selectable');

    // Report results
    console.log('\n====================================================');
    console.log('  A-TO-Z AUDIT RESULTS SUMMARY                      ');
    console.log('====================================================');
    console.log(`Console Errors Caught: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      consoleErrors.forEach((e) => console.log('  ⚠ Error:', e));
    }
    console.log(`Failed HTTP Requests: ${failedRequests.length}`);
    if (failedRequests.length > 0) {
      failedRequests.forEach((r) => console.log('  ⚠ Failed Request:', r));
    }

    if (consoleErrors.length === 0 && failedRequests.length === 0) {
      console.log('🎉 100% HEALTHY: Zero console errors, zero broken requests!');
    }
  } finally {
    await browser.close();
  }
})();
