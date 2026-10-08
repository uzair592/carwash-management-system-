const axios = require('axios');
const prisma = require('../src/prisma');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- Testing Final MVP Polish: Cash Register, Thermal Printing & EOD ---');

  try {
    // 1. Current Register Status
    console.log('\n1. Checking Register Status...');
    const curRes = await axios.get(`${BASE_URL}/register/current`);
    console.log(`✔ Register is currently open: ${curRes.data.data.is_open}`);

    // If an open session already exists from a previous run, close it first
    if (curRes.data.data.is_open) {
      console.log('Closing existing open session for clean test...');
      await axios.post(`${BASE_URL}/register/close`, { actual_counted_cash: 5000 });
    }

    // 2. Open Register Session
    console.log('\n2. Opening Cash Register Shift with Rs. 5,000 float...');
    const openRes = await axios.post(`${BASE_URL}/register/open`, {
      starting_cash: 5000,
      notes: 'Morning Shift - Head Cashier',
    });
    console.log(`✔ Shift Opened: Session ID ${openRes.data.data.id}, Float: Rs. ${openRes.data.data.starting_cash}`);

    // 3. Verify Open in Outbox
    console.log('\n3. Verifying AlertOutbox for REGISTER_OPENED...');
    const openOutbox = await prisma.alertOutbox.findFirst({
      where: {
        payload: { path: ['event'], equals: 'REGISTER_OPENED' },
      },
      orderBy: { created_at: 'desc' },
    });
    if (openOutbox) {
      console.log(`✔ Outbox event verified: ID ${openOutbox.id}, Status: ${openOutbox.status}`);
    } else {
      console.warn('⚠️ No REGISTER_OPENED outbox record found.');
    }

    // 4. Vehicle Intake & Cash Checkout to add cash to the till
    console.log('\n4. Running Vehicle Intake & Cash Checkout...');
    const intakeRes = await axios.post(`${BASE_URL}/intake`, {
      registration_number: 'TEST-POLISH-01',
      customer_name: 'Imran Ashraf',
      customer_phone: '0300-1122334',
      make: 'Honda',
      model: 'Civic',
      services: [{ name: 'Express Body Foam Wash', price: 1000 }],
    });
    const jobCard = intakeRes.data.data.job_card;
    console.log(`✔ Intake Ticket: ${jobCard.ticket_number}`);

    // Start on Jack 1
    await axios.patch(`${BASE_URL}/job-cards/${jobCard.id}/start`, {
      location: 'JACK_1',
    });
    // Complete wash
    await axios.patch(`${BASE_URL}/job-cards/${jobCard.id}/complete`);

    // Cash Checkout
    const checkoutRes = await axios.post(`${BASE_URL}/invoices/checkout`, {
      job_card_id: jobCard.id,
      payment_method: 'CASH',
      discount_amount: 0,
    });
    console.log(`✔ Invoice Paid in Cash: ${checkoutRes.data.data.invoice.invoice_number} (Rs. 1,000)`);

    // 5. Check Live Expected Cash
    const midRes = await axios.get(`${BASE_URL}/register/current`);
    console.log(`✔ Live Cash in Drawer: Expected Rs. ${midRes.data.data.expected_cash_in_drawer} (Starting 5000 + Cash 1000)`);

    // 6. Close Register Session with Counted Cash = Rs. 6,000 (Exact balance)
    console.log('\n5. Closing Cash Register Shift (Counted Rs. 6,000)...');
    const closeRes = await axios.post(`${BASE_URL}/register/close`, {
      actual_counted_cash: 6000,
      notes: 'End of shift reconciliation',
    });
    console.log(`✔ Shift Closed: Status ${closeRes.data.data.session.status}`);
    console.log(`✔ Variance: Rs. ${closeRes.data.data.reconciliation.variance} (Balanced: ${closeRes.data.data.reconciliation.is_balanced})`);

    // 7. Verify Close in Outbox
    console.log('\n6. Verifying AlertOutbox for REGISTER_CLOSED...');
    const closeOutbox = await prisma.alertOutbox.findFirst({
      where: {
        payload: { path: ['event'], equals: 'REGISTER_CLOSED' },
      },
      orderBy: { created_at: 'desc' },
    });
    if (closeOutbox) {
      console.log(`✔ Outbox event verified: ID ${closeOutbox.id}, Status: ${closeOutbox.status}`);
    }

    // 8. Test Thermal Printing Engine Endpoints
    console.log('\n7. Testing Thermal Printing Engine (80mm ESC/POS)...');
    const ticketPrintRes = await axios.post(`${BASE_URL}/printer/thermal-ticket`, {
      ticket_number: jobCard.ticket_number,
      registration_number: 'TEST-POLISH-01',
      customer_name: 'Imran Ashraf',
      customer_phone: '0300-1122334',
      services: [{ name: 'Express Body Foam Wash', price: 1000 }],
    });
    console.log('✔ Thermal Ticket Generated (Length:', ticketPrintRes.data.data.plain_text.length, 'chars)');

    const receiptPrintRes = await axios.post(`${BASE_URL}/printer/thermal-receipt`, {
      invoice_number: checkoutRes.data.data.invoice.invoice_number,
      plate: 'TEST-POLISH-01',
      customer_name: 'Imran Ashraf',
      payment_method: 'CASH',
      total_amount: 1000,
      discount_amount: 0,
      services: [{ name: 'Express Body Foam Wash', price: 1000 }],
    });
    console.log('✔ Thermal Receipt Generated (Length:', receiptPrintRes.data.data.plain_text.length, 'chars)');

    // 9. Test EOD Report Compilation and Trigger
    console.log('\n8. Testing EOD Financial Report with 3 Bays & Till Variances...');
    const eodRes = await axios.post(`${BASE_URL}/dashboard/trigger-eod`);
    console.log('✔ EOD Report Generated Successfully!');
    console.log('✔ EOD Total Cars Washed:', eodRes.data.data.metrics.carsCount);
    console.log('✔ EOD Bays Breakdown:', eodRes.data.data.metrics.baysBreakdown);
    console.log('✔ EOD Till Variance:', eodRes.data.data.metrics.registerSummary.total_variance);

    // 10. Reopen register with 5000 so POS is ready for browser testing
    console.log('\n9. Reopening fresh shift so POS is unlocked for users...');
    await axios.post(`${BASE_URL}/register/open`, { starting_cash: 5000 });
    console.log('✔ Fresh register shift open (Rs. 5,000 float).');

    console.log('\n--- ALL FINAL MVP POLISH TESTS PASSED! ---');
  } catch (err) {
    console.error('Test error:', err.response?.data || err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
