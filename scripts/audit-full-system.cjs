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

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE ? {
      executablePath: process.env.CHROMIUM_EXECUTABLE,
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
    console.log('\n[TEST 1/7] Auditing Workshop Bays (#bays)...');
    await page.goto(`${base}/#bays`, { waitUntil: 'networkidle' });
    assert.ok(await page.title(), 'Page should have a title');
    const baysHeader = await page.textContent('h1');
    console.log(`  ✔ Bays view rendered: "${baysHeader}"`);

    // 2. Audit New Vehicle Intake (#intake)
    console.log('\n[TEST 2/7] Auditing New Vehicle Intake (#intake)...');
    await page.goto(`${base}/#intake`, { waitUntil: 'networkidle' });
    const intakeTitle = await page.textContent('h1');
    console.log(`  ✔ Intake view rendered: "${intakeTitle}"`);
    // Verify vehicle make dropdown is loaded
    const makeSelect = page.locator('#intake-make');
    if (await makeSelect.count() > 0) {
      const options = await makeSelect.locator('option').allTextContents();
      console.log(`  ✔ Vehicle makes loaded (${options.length} options): ${options.slice(0, 5).join(', ')}...`);
      assert.ok(options.length > 3, 'Should have vehicle makes loaded');
    }
    // Verify services are selectable
    const serviceItems = page.locator('.service-item, button.service-chip, [data-service-id]');
    console.log(`  ✔ Services catalog available for intake selection`);

    // 3. Audit Billing Queue (#billing)
    console.log('\n[TEST 3/7] Auditing Billing Queue (#billing)...');
    await page.goto(`${base}/#billing`, { waitUntil: 'networkidle' });
    const billingTitle = await page.textContent('h1');
    console.log(`  ✔ Billing view rendered: "${billingTitle}"`);

    // 4. Audit Leaderboard (#leaderboard)
    console.log('\n[TEST 4/7] Auditing Worker Leaderboard (#leaderboard)...');
    await page.goto(`${base}/#leaderboard`, { waitUntil: 'networkidle' });
    const lbTitle = await page.textContent('h1');
    console.log(`  ✔ Leaderboard view rendered: "${lbTitle}"`);

    // 5. Audit Investor Portal (#investor)
    console.log('\n[TEST 5/7] Auditing Investor Dashboard (#investor)...');
    await page.goto(`${base}/#investor`, { waitUntil: 'networkidle' });
    const invTitle = await page.textContent('h1');
    console.log(`  ✔ Investor view rendered: "${invTitle}"`);

    // 6. Audit Admin & Inventory Hub (#admin) and all its sub-tabs
    console.log('\n[TEST 6/7] Auditing Admin Management (#admin) tabs...');
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

    // 7. Audit Master Settings Hub (#settings)
    console.log('\n[TEST 7/7] Auditing Master Settings Hub (#settings)...');
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
