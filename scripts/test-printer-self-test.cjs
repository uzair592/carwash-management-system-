const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
function cli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'printer-self-test.cjs'), ...args]);
    let output = '';
    child.stdout.on('data', b => output += b);
    child.stderr.on('data', b => output += b);
    child.on('error', reject);
    child.on('close', code => resolve({ code, output }));
  });
}
test('Self-test refuses to send without the paper confirmation flag', async () => {
  const r = await cli(['--send','--host','127.0.0.1']);
  assert.equal(r.code, 1);
  assert.match(r.output, /confirm-paper/);
});
test('Self-test sends one labelled 80mm job and exactly one optional cutter command to local TCP', async () => {
  let connections = 0;
  const packets = [];
  const server = net.createServer(socket => {
    connections++;
    socket.on('data', b => packets.push(b));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try {
    const r = await cli(['--send','--confirm-paper','--host','127.0.0.1','--port',String(server.address().port),'--cut']);
    assert.equal(r.code, 0, r.output);
    assert.equal(connections, 1);
    const received = Buffer.concat(packets);
    assert.match(received.toString('ascii'), /NOT A SALE/);
    assert.equal(received.toString('hex').split('1d5600').length - 1, 1);
    assert(received.subarray(-3).equals(Buffer.from([0x1d,0x56,0])));
    assert.match(r.output, /NOT automatically verified/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
