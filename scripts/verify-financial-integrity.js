const assert = require('node:assert/strict');
const axios = require('axios');
const prisma = require('../src/prisma');
const { generateThermalCustomerReceipt } = require('../src/services/printer.service');

const BASE_URL = 'http://localhost:5000';

(async () => {
  console.log('========================================================');
  console.log(' FINANCIAL & SECURITY INTEGRITY VERIFICATION SUITE      ');
  console.log('========================================================\n');

  // TEST 1: Receipt calculations on UNPAID invoice
  console.log('[TEST 1] Verifying Thermal Receipt on Rs. 1,000 Unpaid Invoice...');
  const unpaidReceipt = await generateThermalCustomerReceipt({
    invoice_number: 'INV-TEST-UNPAID',
    total_amount: 1000,
    paid_amount: 0,
    status: 'UNPAID',
    services: [{ name: 'Express Wash', price_charged: 1000 }],
  });
  assert.match(unpaidReceipt.plain_text, /SUBTOTAL:\s+Rs\. 1,000/, 'Subtotal must be exactly Rs. 1,000, NOT Rs. 2,000');
  assert.match(unpaidReceipt.plain_text, /AMOUNT PAID:\s+Rs\. 0/, 'Amount paid must be Rs. 0, NOT Rs. 1,000');
  assert.match(unpaidReceipt.plain_text, /BALANCE DUE:\s+Rs\. 1,000/, 'Balance due must be Rs. 1,000');
  console.log('  ✔ Subtotal correctly calculated as Rs. 1,000 (no double counting)');
  console.log('  ✔ Paid amount correctly reported as Rs. 0 on UNPAID ticket\n');

  // TEST 2: Intake does not inflate loyalty visit counter
  console.log('[TEST 2] Verifying Vehicle Intake does NOT inflate loyalty visit count...');
  const testPlate = `INTAKE-TEST-${Date.now().toString().slice(-4)}`;
  const intakeRes = await axios.post(`${BASE_URL}/api/intake`, {
    registration_number: testPlate,
    services: [{ service_id: (await prisma.service.findFirst()).id }],
  });
  assert.equal(intakeRes.status, 201);
  const createdJob = intakeRes.data.data.job_card;
  const createdVehicle = intakeRes.data.data.vehicle;
  const vehicleAfterIntake = await prisma.vehicle.findUnique({ where: { id: createdVehicle.id } });
  assert.equal(vehicleAfterIntake.visits, 0, 'Intake attempt MUST NOT increment visits counter');
  console.log('  ✔ Intake ticket created without inflating loyalty visits (visits: 0)\n');

  // TEST 3: Cash tendered under-payment rejected
  console.log('[TEST 3] Verifying under-tender rejection (Rs. 100 tendered on Rs. 1,000 bill)...');
  // Complete job card so it is ready for checkout
  await prisma.jobCard.update({
    where: { id: createdJob.id },
    data: { status: 'READY_FOR_BILLING' },
  });

  try {
    await axios.post(`${BASE_URL}/api/invoices/checkout`, {
      job_card_id: createdJob.id,
      payment_method: 'CASH',
      cash_tendered: 100, // bill is > 100, but collected_amount is omitted
    });
    assert.fail('Should have rejected insufficient cash tender without explicit collected_amount');
  } catch (err) {
    assert.equal(err.response?.status, 400);
    assert.match(err.response?.data?.message, /insufficient/i);
    console.log(`  ✔ Under-tender rejected with 400: "${err.response.data.message}"\n`);
  }

  // TEST 4: Excess cash tendered returns change, never inflates paid_amount
  console.log('[TEST 4] Verifying excess cash tendered returns change (Rs. 1,500 tendered on bill)...');
  const jobCardForOverpay = await prisma.jobCard.findUnique({
    where: { id: createdJob.id },
    include: { services: true },
  });
  const billTotal = jobCardForOverpay.services.reduce((s, x) => s + parseFloat(x.price_charged), 0);
  const overpayTender = billTotal + 500;

  const checkoutRes = await axios.post(`${BASE_URL}/api/invoices/checkout`, {
    job_card_id: createdJob.id,
    payment_method: 'CASH',
    cash_tendered: overpayTender,
    collected_amount: overpayTender,
  });
  assert.equal(checkoutRes.status, 200);
  const inv = checkoutRes.data.data.invoice;
  assert.equal(parseFloat(inv.total_amount), billTotal, 'Invoice total must match service charges');
  assert.equal(parseFloat(inv.paid_amount), billTotal, 'Invoice paid amount cannot exceed total amount');
  assert.equal(parseFloat(inv.change_returned), 500, 'Excess Rs. 500 MUST be returned as change');
  assert.equal(inv.status, 'PAID');
  console.log(`  ✔ Bill Total: Rs. ${billTotal}, Tendered: Rs. ${overpayTender}`);
  console.log(`  ✔ Paid Recorded: Rs. ${inv.paid_amount}, Change Returned: Rs. ${inv.change_returned}\n`);

  // TEST 5: Verify completed visit incremented strictly once upon checkout
  console.log('[TEST 5] Verifying loyalty visits incremented strictly once upon job completion...');
  const vehicleAfterCheckout = await prisma.vehicle.findUnique({ where: { id: createdJob.vehicle_id } });
  assert.equal(vehicleAfterCheckout.visits, 1, 'Completed checkout must increment visits by exactly 1');
  console.log('  ✔ Completed visit recorded accurately (visits: 1)\n');

  // TEST 6: Append-only audit journal entries created
  console.log('[TEST 6] Verifying append-only ledger audit journal entries...');
  const auditEntries = await prisma.auditLog.findMany({
    where: { action: 'LEDGER_ENTRY' },
    orderBy: { created_at: 'desc' },
    take: 3,
  });
  assert(auditEntries.length > 0, 'Audit journal MUST record immutable ledger entries');
  console.log(`  ✔ Found ${auditEntries.length} append-only ledger journal entries (latest: "${auditEntries[0].description}")\n`);

  // TEST 7: Authentication security check
  console.log('[TEST 7] Verifying forged/invalid Bearer token is rejected with 401...');
  try {
    await axios.get(`${BASE_URL}/api/users`, {
      headers: { Authorization: 'Bearer invalid.fake.token' },
    });
    assert.fail('Invalid bearer token must be rejected');
  } catch (err) {
    assert.equal(err.response?.status, 401);
    console.log(`  ✔ Invalid token rejected with 401: "${err.response.data.message}"\n`);
  }

  // Cleanup test job
  console.log('========================================================');
  console.log('🎉 ALL 7 FINANCIAL & SECURITY CHECKS PASSED PERFECTLY!  ');
  console.log('========================================================');
})().catch((err) => {
  console.error('FAILED:', err.response?.data || err.message);
  process.exitCode = 1;
});
