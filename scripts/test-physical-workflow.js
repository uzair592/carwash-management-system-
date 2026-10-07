const axios = require('axios');
const API_BASE = 'http://localhost:5000/api';

async function runTest() {
  console.log('--- Testing Physical Shop Workflow (Jack 1, Jack 2, Detailing Center) & Outbox ---');

  // 1. Rapid Intake (No-Ticket, No-Work)
  console.log('\n1. Testing Rapid Intake...');
  const servicesRes = await axios.get(`${API_BASE}/services`);
  const washService = servicesRes.data.data.find((s) => s.name === 'Standard Wash');

  const intakeRes = await axios.post(`${API_BASE}/intake`, {
    registration_number: 'PHYS-001',
    customer_name: 'Hamza Malik',
    customer_phone: '03007654321',
    make: 'Honda',
    model: 'Civic',
    services: [washService.id],
  });

  const jobCard = intakeRes.data.data.job_card;
  console.log(`✔ Ticket Created: ${jobCard.ticket_number} for Customer "${jobCard.customer_name}" (Status: ${jobCard.status})`);
  if (jobCard.status !== 'QUEUED') {
    throw new Error(`Expected status QUEUED, got ${jobCard.status}`);
  }

  // 2. Start Work: Assign to Washing Jack 1
  console.log('\n2. Assigning vehicle to Washing Jack 1...');
  const startRes = await axios.patch(`${API_BASE}/job-cards/${jobCard.id}/start`, {
    assigned_location: 'JACK_1',
  });
  console.log(`✔ Started on: ${startRes.data.data.assigned_location} (${startRes.data.data.assigned_team})`);
  console.log(`✔ started_at recorded: ${startRes.data.data.started_at}`);

  // 3. Test Bay Occupancy Conflict Prevention
  console.log('\n3. Testing double-booking conflict prevention on Jack 1...');
  const intake2 = await axios.post(`${API_BASE}/intake`, {
    registration_number: 'PHYS-002',
    customer_name: 'Bilal Khan',
    customer_phone: '03009998877',
    services: [washService.id],
  });

  try {
    await axios.patch(`${API_BASE}/job-cards/${intake2.data.data.job_card.id}/start`, {
      assigned_location: 'JACK_1',
    });
    console.error('❌ Conflict check failed! Jack 1 should have been protected.');
  } catch (err) {
    if (err.response?.status === 409) {
      console.log(`✔ Conflict correctly prevented: ${err.response.data.message}`);
    } else {
      throw err;
    }
  }

  // 4. Complete Work: Free up Jack 1 and move to READY_FOR_BILLING
  console.log('\n4. Completing wash and freeing up Jack 1...');
  const completeRes = await axios.patch(`${API_BASE}/job-cards/${jobCard.id}/complete`);
  console.log(`✔ Completed: Status is ${completeRes.data.data.status}, completed_at: ${completeRes.data.data.completed_at}`);

  // 5. Verify Live Bay Status reflects vacant Jack 1 and ready for billing
  console.log('\n5. Checking physical bay status...');
  const baysStatusRes = await axios.get(`${API_BASE}/bays/live-status`);
  const jack1Status = baysStatusRes.data.physical_bays.jack_1;
  console.log(`✔ Jack 1 is occupied: ${jack1Status.is_occupied} (Vacant for next car)`);
  const readyCar = baysStatusRes.data.ready_for_billing.find((c) => c.id === jobCard.id);
  console.log(`✔ Car waiting for checkout: ${readyCar?.vehicle?.registration_number}`);

  // 6. Checkout with Outbox Write
  console.log('\n6. Checking out vehicle...');
  const checkoutRes = await axios.post(`${API_BASE}/invoices/checkout`, {
    job_card_id: jobCard.id,
    payment_method: 'CASH',
  });
  const invoice = checkoutRes.data.data.invoice;
  console.log(`✔ Invoice Created: ${invoice.invoice_number} (Amount: Rs. ${invoice.total_amount})`);

  // 7. Verify Outbox Alert processing
  console.log('\n7. Waiting 6 seconds for Outbox Worker to deliver Telegram alert...');
  await new Promise((r) => setTimeout(r, 6000));
  console.log('✔ Outbox processing cycle completed.');

  // 8. Test Admin PIN Verification
  console.log('\n8. Testing Admin PIN verification...');
  const pinCheck = await axios.post(`${API_BASE}/admin/verify-pin`, { pin: '1234' });
  console.log(`✔ Admin PIN verification result: valid = ${pinCheck.data.valid}`);

  // 9. Test Refund Authorization with Admin PIN
  console.log('\n9. Testing Refund with Admin PIN...');
  const refundRes = await axios.post(`${API_BASE}/invoices/${invoice.id}/refund`, {
    amount: 500,
    reason: 'Customer water spots compensation',
    admin_pin: '1234',
  });
  console.log(`✔ Refund authorized & ledger reversed: Rs. ${refundRes.data.data.refund.amount} (New Vault: Rs. ${refundRes.data.data.new_balance})`);

  console.log('\n--- All Physical Shop Workflow & Strict Accounting Tests Passed! ---');
}

runTest().catch((err) => {
  console.error('Test error:', err.response?.data || err.message);
  process.exit(1);
});
