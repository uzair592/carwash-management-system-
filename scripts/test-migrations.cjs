// Runs only in disposable in-memory PostgreSQL (WASM); never opens DATABASE_URL.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const root = path.join(__dirname, '../prisma/migrations');
const migrations = fs.readdirSync(root).filter(n => fs.existsSync(path.join(root, n, 'migration.sql'))).sort();
async function apply(db, name) {
  await db.exec(fs.readFileSync(path.join(root, name, 'migration.sql'), 'utf8'));
}
async function checks(db) {
  await db.exec(`INSERT INTO users (id,name,role,pin_code,updated_at,permissions) VALUES ('operator','Test accountant','Accountant','',now(),'{"reports.read":true}');
    INSERT INTO printer_settings (id,updated_at,mode,auto_cut) VALUES ('shop',now(),'NETWORK',true);
    INSERT INTO printer_jobs (id,request_key,kind,document_id,requested_by) VALUES ('p1','test-key','TICKET','j1','operator');`);
  await assert.rejects(db.exec(`INSERT INTO printer_jobs (id,request_key,kind,document_id,requested_by) VALUES ('p2','test-key','TICKET','j1','operator')`), e => e.code === '23505');
  const permissions = await db.query(`SELECT permissions FROM users WHERE id='operator'`);
  assert.equal(permissions.rows[0].permissions['reports.read'], true);
  const table = await db.query(`SELECT services_version FROM job_cards LIMIT 1`);
  if (table.rows.length) assert.equal(table.rows[0].services_version, 0);
}
async function run() {
  const fresh = new PGlite();
  try {
    for (const name of migrations) { await apply(fresh, name); console.log('PASS fresh migration:', name); }
    await checks(fresh);
    console.log('PASS enum, permission JSON and unique print-request constraints');
  } finally { await fresh.close(); }
  const legacy = new PGlite();
  try {
    await apply(legacy, migrations[0]);
    await legacy.exec(`INSERT INTO vehicles (id,registration_number,updated_at) VALUES ('v1','TEST-001',now());
      INSERT INTO job_cards (id,vehicle_id,status,updated_at) VALUES ('j1','v1','Completed','2026-10-07T10:00:00');
      INSERT INTO job_cards (id,vehicle_id,status,assigned_location,updated_at) VALUES ('active1','v1','IN_PROGRESS','DETAILING_CENTER',now());
      INSERT INTO invoices (id,job_card_id,total_amount,paid_amount) VALUES ('i1','j1',1200,1200);
      INSERT INTO refunds (id,invoice_id,amount,reason,authorized_by_pin) VALUES ('r1','i1',100,'Test fixture','1234');
      INSERT INTO customer_deposits (id,vehicle_id,customer_name,amount,status) VALUES ('d1','v1','Test',500,'ACTIVE'),('d2','v1','Test',300,'APPLIED');`);
    for (const name of migrations.slice(1)) await apply(legacy, name);
    const balances = await legacy.query(`SELECT id,amount::text,remaining_amount::text FROM customer_deposits ORDER BY id`);
    assert.deepEqual(balances.rows.map(r => [r.amount,r.remaining_amount]), [['500.00','500.00'],['300.00','0.00']]);
    assert.equal((await legacy.query(`SELECT total_amount::text FROM invoices WHERE id='i1'`)).rows[0].total_amount, '1200.00');
    assert.equal((await legacy.query(`SELECT authorized_by_pin FROM refunds WHERE id='r1'`)).rows[0].authorized_by_pin, 'APPROVED');
    assert.equal((await legacy.query(`SELECT to_char(completed_at, 'YYYY-MM-DD HH24:MI:SS') AS completed FROM job_cards WHERE id='j1'`)).rows[0].completed, '2026-10-07 10:00:00');
    await assert.rejects(legacy.exec(`INSERT INTO job_cards (id,vehicle_id,status,assigned_location,updated_at) VALUES ('active2','v1','In_Progress','DETAILING_BAY_1',now())`), e => e.code === '23505');
    await legacy.exec(`INSERT INTO job_cards (id,vehicle_id,status,assigned_location,updated_at) VALUES ('active3','v1','IN_PROGRESS','DETAILING_BAY_2',now())`);
    await checks(legacy);
    console.log('PASS legacy upgrade: invoice totals, advances, completion dates and removed PIN secrets');
    console.log('PASS active-bay aliases reject collisions; second detailing bay remains available');
  } finally { await legacy.close(); }
  console.log('Migration SQL verified using disposable embedded PostgreSQL. Prisma deployment and multi-process concurrency on the shop server still require verification.');
}
run().catch(e => { console.error(e.message); process.exitCode = 1; });
