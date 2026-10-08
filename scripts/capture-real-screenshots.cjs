const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(__dirname, '../client')] }));

const screenshotsDir = path.join(__dirname, '../docs/ui');
fs.mkdirSync(screenshotsDir, { recursive: true });

function post(url, data) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': 'Bearer 00000000-0000-0000-0000-000000000001:Admin',
      },
    }, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

(async () => {
  // Ensure an open register shift exists so cashier modal doesn't block
  await post('http://localhost:5000/api/register/open', {
    starting_cash: 5000,
    opened_by_user_id: '00000000-0000-0000-0000-000000000001',
    notes: 'Screenshot session float',
  });

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE ? {
      executablePath: process.env.CHROMIUM_EXECUTABLE,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    } : {})
  });

  try {
    // 1. Desktop 1366x768 (14-inch laptop viewport)
    const desktopContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await desktopContext.newPage();

    // Set role to ADMIN in localStorage so all management tabs and actions are unrestricted
    await page.addInitScript(() => {
      localStorage.setItem('dfpro_auth_user', JSON.stringify({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Shop Owner & Admin',
        role: 'ADMIN',
      }));
    });

    // Go to New Vehicle Intake with live database
    await page.goto('http://localhost:3000/#intake');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    // If register modal is visible, close or submit it
    const openShiftBtn = page.getByRole('button', { name: /Open Register/i });
    if (await openShiftBtn.count()) {
      await openShiftBtn.click().catch(() => {});
      await page.waitForTimeout(400);
    }

    // Type a returning vehicle plate: AUDI-9900 (has 4 completed visits)
    await page.getByLabel('Vehicle plate').fill('AUDI-9900');
    await page.waitForTimeout(900); // Plate check debounce

    // Take screenshot of New Vehicle Intake with Returning & Loyal Badges and Service Cards
    await page.screenshot({ path: path.join(screenshotsDir, 'desktop_intake_real.png'), fullPage: true });
    console.log('✔ Captured desktop_intake_real.png');

    // Go to Workshop Bay Dashboard
    await page.goto('http://localhost:3000/#bays');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotsDir, 'desktop_workshop_4bays_real.png'), fullPage: true });
    console.log('✔ Captured desktop_workshop_4bays_real.png');

    // Go to Admin Panel
    await page.goto('http://localhost:3000/#admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    // If PIN prompt is present, unlock
    const pinInput = page.getByPlaceholder('Enter management PIN');
    if (await pinInput.count()) {
      await pinInput.fill('1122');
      await page.getByRole('button', { name: /Unlock Admin Panel/i }).click();
      await page.waitForTimeout(500);
    }

    // Click Services tab
    const servicesTab = page.getByRole('button', { name: /Services/i });
    if (await servicesTab.count()) {
      await servicesTab.first().click({ force: true });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(screenshotsDir, 'desktop_admin_services_real.png') });
      console.log('✔ Captured desktop_admin_services_real.png');
    }

    // Click Staff tab
    const staffTab = page.getByRole('button', { name: /Staff/i });
    if (await staffTab.count()) {
      await staffTab.first().click({ force: true });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(screenshotsDir, 'desktop_admin_staff_real.png') });
      console.log('✔ Captured desktop_admin_staff_real.png');
    }

    // Click Banks tab
    const banksTab = page.getByRole('button', { name: /Bank Accounts/i });
    if (await banksTab.count()) {
      await banksTab.first().click({ force: true });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(screenshotsDir, 'desktop_admin_banks_real.png') });
      console.log('✔ Captured desktop_admin_banks_real.png');
    }

    // Click Branding tab
    const brandingTab = page.getByRole('button', { name: /Branding/i });
    if (await brandingTab.count()) {
      await brandingTab.first().click({ force: true });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(screenshotsDir, 'desktop_admin_branding_real.png') });
      console.log('✔ Captured desktop_admin_branding_real.png');
    }

    await desktopContext.close();

    // 2. Tablet Viewport (1024x768)
    const tabletContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const tabletPage = await tabletContext.newPage();
    await tabletPage.addInitScript(() => {
      localStorage.setItem('dfpro_auth_user', JSON.stringify({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Shop Owner & Admin',
        role: 'ADMIN',
      }));
    });

    await tabletPage.goto('http://localhost:3000/#intake');
    await tabletPage.waitForLoadState('networkidle');
    await tabletPage.waitForTimeout(600);
    await tabletPage.screenshot({ path: path.join(screenshotsDir, 'tablet_intake_real.png'), fullPage: true });
    console.log('✔ Captured tablet_intake_real.png');

    await tabletPage.goto('http://localhost:3000/#bays');
    await tabletPage.waitForLoadState('networkidle');
    await tabletPage.waitForTimeout(600);
    await tabletPage.screenshot({ path: path.join(screenshotsDir, 'tablet_workshop_real.png'), fullPage: true });
    console.log('✔ Captured tablet_workshop_real.png');

    await tabletContext.close();
    console.log('🎉 All real data screenshots captured successfully!');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
