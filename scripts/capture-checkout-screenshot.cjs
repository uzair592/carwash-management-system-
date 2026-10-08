const path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(__dirname, '../client')] }));

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE ? {
      executablePath: process.env.CHROMIUM_EXECUTABLE,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    } : {})
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('dfpro_auth_user', JSON.stringify({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Shop Owner & Admin',
        role: 'ADMIN',
      }));
    });

    await page.goto('http://localhost:3000/#billing');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    const collectBtn = page.getByRole('button', { name: /Collect payment/i });
    if (await collectBtn.count()) {
      await collectBtn.first().click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(__dirname, '../docs/ui/desktop_checkout_real.png') });
      console.log('✔ Captured desktop_checkout_real.png');
    }
  } finally {
    await browser.close();
  }
})();
