const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const QUICK_TUNNEL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i;

function validPort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

function configuredPorts(env = process.env) {
  const ports = [];
  const add = value => {
    const port = validPort(value);
    if (port && !ports.includes(port)) ports.push(port);
  };
  add(env.DFPRO_TUNNEL_PORT);
  add(env.PORT);
  try {
    const ecosystem = require('../ecosystem.config.js');
    const api = ecosystem.apps?.find(app => app.name === 'carwash-api');
    add(api?.env?.PORT);
  } catch {
    // A missing or invalid PM2 file is reported by the health probes below.
  }
  add(5000);
  add(3000);
  return ports;
}

function probeDfPro(port, timeoutMs = 2000) {
  return new Promise(resolve => {
    const request = http.get({
      hostname: '127.0.0.1',
      port,
      path: '/api/health',
      timeout: timeoutMs,
      headers: { Accept: 'application/json' }
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        if (body.length < 65536) body += chunk;
      });
      response.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(response.statusCode === 200 && data.status === 'healthy' && /DF PRO/i.test(data.service || ''));
        } catch {
          resolve(false);
        }
      });
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

async function detectProductionPort(candidates = configuredPorts(), probe = probeDfPro) {
  for (const port of candidates) {
    if (await probe(port)) return port;
  }
  throw new Error(`DF PRO is not responding on the configured production ports (${candidates.join(', ')}). Start the shop with start-shop.bat first.`);
}

function findCloudflared(env = process.env) {
  if (env.CLOUDFLARED_BIN) {
    const configured = path.resolve(env.CLOUDFLARED_BIN);
    if (!fs.existsSync(configured)) throw new Error(`CLOUDFLARED_BIN does not exist: ${configured}`);
    return configured;
  }
  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = spawnSync(locator, ['cloudflared'], { encoding: 'utf8', windowsHide: true });
  const located = result.status === 0 ? result.stdout.split(/\r?\n/).find(Boolean)?.trim() : '';
  if (located) return located;
  throw new Error('cloudflared is not installed or is not on PATH. On Windows run: winget install --id Cloudflare.cloudflared --exact');
}

function extractQuickTunnelUrl(output) {
  return output.match(QUICK_TUNNEL_PATTERN)?.[0] || null;
}

function runQuickTunnel({ cloudflared, port, spawnProcess = spawn, output = process.stdout, errorOutput = process.stderr }) {
  const origin = `http://127.0.0.1:${port}`;
  const child = spawnProcess(cloudflared, ['tunnel', '--url', origin, '--no-autoupdate'], {
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
    shell: false,
    windowsHide: false,
    stdio: ['inherit', 'pipe', 'pipe']
  });
  let buffer = '';
  let announcedUrl = null;
  const relay = (target, chunk) => {
    target.write(chunk);
    buffer = (buffer + chunk.toString()).slice(-16384);
    const url = extractQuickTunnelUrl(buffer);
    if (url && url !== announcedUrl) {
      announcedUrl = url;
      output.write(`\nDF PRO mobile URL: ${url}\n`);
      output.write('Keep this window open. This temporary URL changes whenever the tunnel restarts.\n\n');
    }
  };
  child.stdout.on('data', chunk => relay(output, chunk));
  child.stderr.on('data', chunk => relay(errorOutput, chunk));
  child.on('error', error => errorOutput.write(`Unable to start cloudflared: ${error.message}\n`));
  return { child, origin, getUrl: () => announcedUrl };
}

async function main() {
  const portArgument = process.argv.find(arg => arg.startsWith('--port='));
  const requestedPort = portArgument ? validPort(portArgument.slice(7)) : null;
  if (portArgument && !requestedPort) throw new Error('Use --port= followed by a valid TCP port.');
  const candidates = requestedPort ? [requestedPort] : configuredPorts();
  const port = await detectProductionPort(candidates);
  const cloudflared = findCloudflared();
  console.log(`Detected DF PRO production app at http://127.0.0.1:${port}`);
  console.log('Starting a Cloudflare Quick Tunnel. PostgreSQL and other device ports remain private.');
  const tunnel = runQuickTunnel({ cloudflared, port });
  const stop = () => {
    if (!tunnel.child.killed) tunnel.child.kill();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const code = await new Promise(resolve => tunnel.child.once('close', resolve));
  if (code && !tunnel.getUrl()) throw new Error(`cloudflared stopped before creating a Quick Tunnel (exit ${code}).`);
  process.exitCode = code || 0;
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  configuredPorts,
  detectProductionPort,
  extractQuickTunnelUrl,
  findCloudflared,
  probeDfPro,
  runQuickTunnel,
  validPort
};
