const net = require('net');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const {
  spawn
} = require('child_process');
const F = require('./finance.service');
function clean(value) {
  return String(value ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/[^\x20-\x7e]/g, ' ').trim();
}
function wrap(text, width) {
  const words = clean(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (let word of words) {
    while (word.length > width) {
      if (line) {
        lines.push(line);
        line = '';
      }
      lines.push(word.slice(0, width));
      word = word.slice(width);
    }
    if ((line + ' ' + word).trim().length > width) {
      lines.push(line);
      line = word;
    } else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}
const money = n => Number(n || 0).toFixed(2);
function row(left, right, cols) {
  right = clean(right);
  const chunks = wrap(left, Math.max(8, cols - right.length - 1));
  return [...chunks.slice(0, -1), (chunks.at(-1) || '').padEnd(Math.max(0, cols - right.length), ' ') + right].join('\n');
}
function linesForDocument(kind, data, branding, cols, showName) {
  const lines = [],
    separator = '-'.repeat(cols),
    strong = '='.repeat(cols),
    isTicket = kind === 'TICKET';
  const title = showName !== false ? branding.business_name || 'DF PRO' : '';
  if (title) lines.push(...wrap(title, cols));
  if (!isTicket) {
    if (branding.address) lines.push(...wrap(branding.address, cols));
    if (branding.phone) lines.push('Tel: ' + clean(branding.phone));
  }
  lines.push(strong, isTicket ? 'WORK TICKET' : 'CUSTOMER INVOICE', clean(isTicket ? data.ticket_number : data.invoice_number));
  const vehicle = data.vehicle || data.job_card?.vehicle || {};
  lines.push('Vehicle: ' + clean(vehicle.registration_number), new Date(data.created_at || Date.now()).toLocaleString('en-GB', {
    timeZone: 'Asia/Karachi'
  }), separator);
  const customer = data.customer_name || data.job_card?.customer_name || vehicle.customer_name;
  if (customer) lines.push(...wrap('Customer: ' + customer, cols));
  if (vehicle.customer_phone) lines.push('Phone: ' + clean(vehicle.customer_phone));
  const services = data.line_snapshot || data.services || data.job_card?.services || [];
  if (branding.invoice_template === 'SERVICE_LEDGER' && !isTicket) lines.push(row('NO. / SERVICE', 'PKR', cols));
  services.forEach((s, i) => {
    const name = s.service?.name || s.name;
    const label = isTicket ? '[ ] ' + name : branding.invoice_template === 'SERVICE_LEDGER' ? i + 1 + '. ' + name : name;
    if (!isTicket || branding.ticket_show_prices) lines.push(row(label, money(s.price_charged ?? s.price), cols));else lines.push(...wrap(label, cols));
  });
  if (isTicket) {
    if (data.intake_notes) lines.push(separator, ...wrap('Instructions: ' + data.intake_notes, cols));
    lines.push(separator, 'Worker: __________  QC: __________');
    return lines;
  }
  const original = Number(data.total_amount),
    credits = (data.refunds || []).reduce((s, r) => s + Number(r.amount), 0),
    discount = Number(data.discount_amount || 0);
  lines.push(separator, row('Subtotal', money(original + discount), cols));
  if (discount) lines.push(row('Discount', '-' + money(discount), cols));
  if (credits) lines.push(row('Refund / credit', '-' + money(credits), cols));
  lines.push(strong, row('TOTAL RS.', money(original - credits), cols), strong, row('Paid', money(data.paid_amount), cols), row('Balance due', money(data.balance_due), cols));
  const advance = (data.deposit_applications || []).reduce((s, a) => s + Number(a.amount), 0);
  if (advance) lines.push(row('Advance applied', money(advance), cols));
  const payments = new Map();
  for (const p of data.payments || []) {
    const method = p.bank_account?.bank_name || p.payment_method;
    payments.set(method, (payments.get(method) || 0) + Number(p.amount));
  }
  for (const [method, value] of payments) lines.push(row(method, money(value), cols));
  if (Number(data.cash_tendered) > 0) lines.push(row('Cash tendered', money(data.cash_tendered), cols));
  if (Number(data.change_returned) > 0) lines.push(row('Change returned', money(data.change_returned), cols));
  if (branding.invoice_template === 'STUDIO_SIGNED') lines.push(separator, 'Received by: _____________________');
  lines.push(separator, 'Thank you for visiting DF PRO');
  return lines;
}
function rasterLogo(value, maxWidth) {
  if (!value) return Buffer.alloc(0);
  const {
    width,
    height,
    data
  } = value;
  if (!Number.isInteger(width) || width < 8 || width > maxWidth || !Number.isInteger(height) || height < 1 || height > 384 || typeof data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw F.error('Invalid printer logo bitmap.');
  const bytes = Math.ceil(width / 8),
    bitmap = Buffer.from(data, 'base64');
  if (bitmap.length !== bytes * height) throw F.error('Invalid printer logo length.');
  return Buffer.concat([Buffer.from([0x1b, 0x61, 1, 0x1d, 0x76, 0x30, 0, bytes & 255, bytes >> 8, height & 255, height >> 8]), bitmap, Buffer.from([0x0a, 0x1b, 0x61, 0])]);
}
function buildEscPos(kind, document, branding, settings, options = {}) {
  const cols = settings.paper_width === 58 ? 32 : 42;
  const lines = linesForDocument(kind, document, branding, cols, options.show_business_name ?? branding.show_business_name);
  const header = Buffer.from([0x1b, 0x40, 0x1b, 0x4d, 0, 0x1b, 0x45, 1, 0x1b, 0x32]); // initialize, Font A, bold, normal spacing
  const body = Buffer.from(lines.join('\n') + '\n', 'ascii');
  const feed = Buffer.from([0x1b, 0x64, settings.cut_feed ?? 3]);
  // One and only one full cut command; no browser-driver print is also sent.
  const cut = settings.auto_cut ? Buffer.from([0x1d, 0x56, 0]) : Buffer.alloc(0);
  return Buffer.concat([header, rasterLogo(options.logo_raster, settings.paper_width === 58 ? 384 : 576), body, feed, cut]);
}
function isLocalHost(host) {
  if (net.isIP(host) !== 4) return false;
  const p = host.split('.').map(Number);
  return p[0] === 10 || p[0] === 192 && p[1] === 168 || p[0] === 172 && p[1] >= 16 && p[1] <= 31 || p[0] === 127;
}
async function sendNetwork(buffer, settings) {
  if (!isLocalHost(settings.host)) throw F.error('Set a valid local printer IP in Settings.');
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: settings.host,
      port: settings.port
    });
    let settled = false;
    const done = e => {
      if (settled) return;
      settled = true;
      socket.destroy();
      e ? reject(e) : resolve();
    };
    socket.setTimeout(8000, () => done(new Error('Printer connection timed out.')));
    socket.on('error', done);
    socket.on('connect', () => socket.end(buffer, () => done()));
  });
}
async function sendWindows(buffer, settings) {
  if (process.platform !== 'win32') throw F.error('Windows RAW printing requires the shop server to run on Windows.');
  if (!settings.printer_name?.trim()) throw F.error('Configure the exact installed printer name.');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dfpro-print-'));
  const file = path.join(directory, 'job.bin');
  try {
    await fs.writeFile(file, buffer);
    const script = `$ErrorActionPreference='Stop'
Add-Type @'
using System; using System.Runtime.InteropServices;
public class DFProRaw {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
 [DllImport("winspool.drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string name,out IntPtr h,IntPtr defaults);
 [DllImport("winspool.drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)] public static extern int StartDocPrinter(IntPtr h,int level,[In] DOCINFO di);
 [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
 [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr h,byte[] data,int count,out int written);
 [DllImport("winspool.drv")] public static extern bool EndPagePrinter(IntPtr h);
 [DllImport("winspool.drv")] public static extern bool EndDocPrinter(IntPtr h);
 [DllImport("winspool.drv")] public static extern bool ClosePrinter(IntPtr h);
 public static void Send(string name,byte[] data) { IntPtr h; if(!OpenPrinter(name,out h,IntPtr.Zero))throw new Exception("Cannot open printer"); try { var di=new DOCINFO{pDocName="DF PRO Thermal",pDataType="RAW"}; if(StartDocPrinter(h,1,di)==0)throw new Exception("Cannot start print document"); try {if(!StartPagePrinter(h))throw new Exception("Cannot start print page"); try {int written;if(!WritePrinter(h,data,data.Length,out written)||written!=data.Length)throw new Exception("Incomplete printer write");}finally{EndPagePrinter(h);}}finally{EndDocPrinter(h);} }finally{ClosePrinter(h);} }
}
'@
[DFProRaw]::Send($env:DFPRO_PRINTER_NAME,[IO.File]::ReadAllBytes($env:DFPRO_PRINT_FILE))`;
    await new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
        env: {
          ...process.env,
          DFPRO_PRINTER_NAME: settings.printer_name,
          DFPRO_PRINT_FILE: file
        },
        windowsHide: true,
        stdio: 'ignore'
      });
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('Windows printer timed out.'));
      }, 15000);
      child.on('error', e => {
        clearTimeout(timer);
        reject(e);
      });
      child.on('exit', code => {
        clearTimeout(timer);
        code === 0 ? resolve() : reject(new Error('Windows printer rejected the RAW job.'));
      });
    });
  } finally {
    await fs.rm(directory, {
      recursive: true,
      force: true
    });
  }
}
module.exports = {
  buildEscPos,
  linesForDocument,
  isLocalHost,
  sendNetwork,
  sendWindows
};
