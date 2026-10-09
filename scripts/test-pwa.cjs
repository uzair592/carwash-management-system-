const assert = require('node:assert/strict');
const express = require('express');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(__dirname, '../client')] }));

async function verifyOfflineTransportContract() {
  global.window = new EventTarget();
  const localValues = new Map();
  global.localStorage = {
    getItem: key => localValues.has(key) ? localValues.get(key) : null,
    setItem: (key, value) => localValues.set(key, String(value)),
    removeItem: key => localValues.delete(key)
  };
  if (typeof CustomEvent === 'undefined') {
    global.CustomEvent = class CustomEvent extends Event {
      constructor(type, options = {}) {
        super(type);
        this.detail = options.detail;
      }
    };
  }
  const offline = await import(`${pathToFileURL(path.join(__dirname, '../client/src/offline.js')).href}?contract=${Date.now()}`);

  const serverError = new Error('Server rejected the request');
  serverError.response = { status: 500, data: { message: 'Failed' } };
  await assert.rejects(
    offline.handleOfflineResponseError(serverError),
    error => error === serverError && error.response.status === 500
  );

  offline.markOffline();
  assert.throws(
    () => offline.guardOfflineMutation({ method: 'post', url: '/api/invoices/test/payments' }),
    error => error.offlineBlocked === true && error.response.status === 503
  );
  console.log('PASS failed HTTP responses stay failed and offline mutations never reach transport');
}

function createFixtureApp() {
  const app = express();
  app.use(express.json());
  let denied = false;
  app.get('/api/auth/me', (req, res) => denied
    ? res.status(401).json({ message: 'Session revoked' })
    : res.json({ user: { id: 'owner', name: 'Owner', role: 'ADMIN', permissions: {} } }));
  app.post('/api/auth/logout', (req, res) => res.json({ status: 'success' }));
  app.get('/api/services', (req, res) => res.json({
    data: [{ id: 's1', name: 'Full wash', price: 500, is_active: true, category: 'Wash', pricing_matrix: { SEDAN: 500 } }]
  }));
  app.get('/api/bays/live-status', (req, res) => res.json({ queue: [], ready_for_billing: [], bays: {} }));
  app.get('/api/ledger', (req, res) => res.json({ data: [{ account_type: 'Cash_Drawer', current_balance: 1500 }] }));
  app.get('/api/register/current', (req, res) => res.json({ data: { is_open: true } }));
  app.get('/api/branding', (req, res) => res.json({ data: { business_name: 'DF PRO' } }));
  app.get('/api/*', (req, res) => res.json({ data: [] }));
  app.use(express.static(path.join(__dirname, '../client/dist')));
  return { app, denyAuthentication: () => { denied = true; }, allowAuthentication: () => { denied = false; } };
}

async function savedStore(page, action) {
  return page.evaluate(async requestedAction => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('dfpro-offline-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const store = database.transaction('saved').objectStore('saved');
    const request = requestedAction === 'keys' ? store.getAllKeys() : store.count();
    const result = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return result;
  }, action);
}

async function verifyPng(page, url, expectedSize) {
  const image = await page.evaluate(async source => Array.from(new Uint8Array(await (await fetch(source)).arrayBuffer())), url);
  assert.deepEqual(image.slice(0, 8), [137, 80, 78, 71, 13, 10, 26, 10]);
  const bytes = Uint8Array.from(image);
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(16), expectedSize);
  assert.equal(view.getUint32(20), expectedSize);
}

(async () => {
  await verifyOfflineTransportContract();
  const fixture = createFixtureApp();
  const server = fixture.app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE,
    headless: true,
    args: ['--no-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await page.evaluate(() => localStorage.setItem('carwash_auth_token', 'test-token'));
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller);

    const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
    assert.equal(manifest.name, 'DF PRO Car Wash & Detailing Center');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.scope, '/');
    assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
    await verifyPng(page, '/icon-192.png', 192);
    await verifyPng(page, '/icon-512.png', 512);
    assert.match(await (await page.request.get(`${origin}/sw.js`)).text(), /self\.addEventListener\('fetch'/);
    console.log('PASS manifest, icons, standalone installation metadata and service worker');

    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.getByRole('button', { name: 'Open navigation', exact: true }).isVisible());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.getByRole('button', { name: 'Save latest for offline', exact: true }).waitFor();
    await page.waitForFunction(() => document.body.innerText.includes('Full wash'));
    console.log('PASS online loading and mobile layout');

    await page.getByRole('button', { name: 'Save latest for offline', exact: true }).click();
    await page.getByRole('button', { name: 'Saved for offline', exact: true }).waitFor();
    const keys = await savedStore(page, 'keys');
    assert(keys.length > 1);
    assert(keys.every(key => key === 'profile' || String(key).startsWith('owner:')));
    console.log('PASS selected snapshots use account-scoped IndexedDB keys');

    await context.setOffline(true);
    await page.reload();
    await page.getByRole('button', { name: 'Offline — saved data', exact: true }).waitFor({ timeout: 20000 });
    await page.getByText(/^Last synced /).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Offline — saved data', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Inventory & finance', exact: true }).click();
    await page.getByRole('button', { name: 'Services Catalog', exact: true }).click();
    await page.getByText('Full wash', { exact: true }).first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Add New Service', exact: true }).isEnabled(), false);
    console.log('PASS offline reload shows saved-data timestamp and read-only controls');

    await context.setOffline(false);
    await page.reload();
    await page.getByRole('button', { name: 'Save latest for offline', exact: true }).waitFor();
    console.log('PASS reconnection returns to current online data');

    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    assert.equal(await savedStore(page, 'count'), 0);
    console.log('PASS logout clears saved account data');

    fixture.allowAuthentication();
    await page.evaluate(() => localStorage.setItem('carwash_auth_token', 'test-token'));
    await page.reload();
    await page.getByRole('button', { name: 'Save latest for offline', exact: true }).click();
    await page.getByRole('button', { name: 'Saved for offline', exact: true }).waitFor();
    fixture.denyAuthentication();
    await page.reload();
    await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    assert.equal(await savedStore(page, 'count'), 0);
    assert.deepEqual(errors, []);
    console.log('PASS rejected authentication purges saved data without exposing a failed request as success');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
