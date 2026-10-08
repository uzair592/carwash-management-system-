// Test-only output; never reads or changes invoices, payments or stock.
const fs = require('node:fs/promises');
const path = require('node:path');
const printer = require('../src/services/thermal-printer.service');
const argv = process.argv.slice(2);
function arg(name, fallback) { const i = argv.indexOf(name); return i < 0 ? fallback : argv[i + 1]; }
async function run() {
  const width = Number(arg('--width', '80'));
  if (![58,80].includes(width)) throw Error('Choose --width 58 or 80.');
  const mode = arg('--mode', 'NETWORK').toUpperCase();
  if (!['NETWORK','WINDOWS'].includes(mode)) throw Error('Choose NETWORK or WINDOWS.');
  const config = { mode, paper_width: width, auto_cut: argv.includes('--cut'), cut_feed: 3, host: arg('--host',''), port: Number(arg('--port','9100')), printer_name: arg('--printer','') };
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw Error('Invalid port.');
  const sample = { id: 'self-test', invoice_number: 'PRINTER TEST - NOT A SALE', created_at: new Date(), total_amount: 1200, paid_amount: 1200, balance_due: 0, job_card: { vehicle: { registration_number: 'TEST-001' } }, line_snapshot: [{ name: 'Bold text and alignment test', price: 1200 }], payments: [{ payment_method: 'Cash', amount: 1200 }] };
  const bytes = printer.buildEscPos('INVOICE', sample, { business_name: 'DF PRO - PRINTER SELF TEST', address: 'Check text, alignment, feed and cutter', invoice_template: 'BOLD_TABLE' }, config);
  if (!argv.includes('--send')) {
    const output = path.resolve(arg('--output', 'dfpro-printer-test.bin'));
    await fs.writeFile(output, bytes);
    console.log('Generated ESC/POS test:', output, '(' + bytes.length + ' bytes). No paper sent.');
    return;
  }
  if (!argv.includes('--confirm-paper')) throw Error('Add --confirm-paper to send one test slip.');
  if (mode === 'NETWORK') await printer.sendNetwork(bytes, config); else await printer.sendWindows(bytes, config);
  console.log('One test job sent. Physical result is NOT automatically verified.');
  console.log('Confirm readable bold text, aligned amounts, no large top gap, and exactly one cut if --cut was enabled.');
  console.log('If delivery is uncertain, inspect the printer before running another test.');
}
run().catch(e => { console.error(e.message); process.exitCode = 1; });
