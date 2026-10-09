const assert = require('node:assert/strict');
const http = require('node:http');
const { PassThrough } = require('node:stream');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const {
  configuredPorts,
  detectProductionPort,
  extractQuickTunnelUrl,
  runQuickTunnel,
  validPort
} = require('./quick-tunnel');

function listen(handler) {
  const server = http.createServer(handler);
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('port validation and configuration reject invalid values and deduplicate candidates', () => {
  assert.equal(validPort('5000'), 5000);
  assert.equal(validPort('0'), null);
  assert.equal(validPort('not-a-port'), null);
  assert.deepEqual(configuredPorts({ DFPRO_TUNNEL_PORT: '5050', PORT: '5050' }).slice(0, 2), [5050, 5000]);
});

test('production-port detection ignores a UI redirect and selects the healthy DF PRO API/UI origin', async () => {
  const redirect = await listen((req, res) => {
    res.writeHead(307, { Location: 'http://127.0.0.1:5000' });
    res.end();
  });
  const production = await listen((req, res) => {
    if (req.url === '/api/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'healthy', service: 'DF PRO Car Wash & Detailing Management System Core API' }));
      return;
    }
    res.writeHead(404).end();
  });
  try {
    const selected = await detectProductionPort([
      redirect.address().port,
      production.address().port
    ]);
    assert.equal(selected, production.address().port);
  } finally {
    await Promise.all([
      new Promise(resolve => redirect.close(resolve)),
      new Promise(resolve => production.close(resolve))
    ]);
  }
});

test('Quick Tunnel output extracts and displays the generated hostname without hardcoding it', async () => {
  const generated = 'https://random-words-for-test.trycloudflare.com';
  assert.equal(extractQuickTunnelUrl(`Visit ${generated} now`), generated);
  assert.equal(extractQuickTunnelUrl('no tunnel here'), null);
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let text = '';
  stdout.on('data', chunk => { text += chunk; });
  const fakeSpawn = (command, args) => {
    assert.equal(command, 'cloudflared');
    assert.deepEqual(args, ['tunnel', '--url', 'http://127.0.0.1:5000', '--no-autoupdate']);
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killed = false;
    child.kill = () => { child.killed = true; };
    queueMicrotask(() => child.stderr.write(`Connector ready: ${generated}\n`));
    return child;
  };
  const tunnel = runQuickTunnel({ cloudflared: 'cloudflared', port: 5000, spawnProcess: fakeSpawn, output: stdout, errorOutput: stderr });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(tunnel.origin, 'http://127.0.0.1:5000');
  assert.equal(tunnel.getUrl(), generated);
  assert.match(text, /DF PRO mobile URL: https:\/\/random-words-for-test\.trycloudflare\.com/);
});
