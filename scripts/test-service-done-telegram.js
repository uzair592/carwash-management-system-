const axios = require('axios');
const prisma = require('../src/prisma');

async function test() {
  const token = '00000000-0000-0000-0000-000000000001:Admin';
  const headers = { Authorization: `Bearer ${token}` };

  console.log('1. Creating intake ticket for car wash test...');
  const intakeRes = await axios.post('http://localhost:5000/api/intake', {
    registration_number: 'TEL-7788',
    customer_name: 'Telegram Test Driver',
    customer_phone: '03001234567',
    make: 'Toyota',
    model: 'Yaris',
    services: ['Standard Body Wash'],
  }, { headers });

  const job = intakeRes.data.data.job_card;
  console.log(`✔ Created Ticket ${job.ticket_number} for ${job.vehicle.registration_number}`);

  console.log('2. Starting job on Jack 1...');
  await axios.patch(`http://localhost:5000/api/job-cards/${job.id}/start`, {
    location: 'JACK_1',
  }, { headers });

  console.log('3. Completing car wash / service work...');
  const completeRes = await axios.patch(`http://localhost:5000/api/job-cards/${job.id}/complete`, {}, { headers });
  console.log('✔ Complete response:', completeRes.data.message);

  console.log('4. Checking AlertOutbox for Telegram notification...');
  const outboxItem = await prisma.alertOutbox.findFirst({
    where: {
      type: 'TELEGRAM',
      payload: { path: ['event'], equals: 'SERVICE_COMPLETED' },
    },
    orderBy: { created_at: 'desc' },
  });

  if (outboxItem) {
    console.log('✔ Telegram Alert successfully queued in AlertOutbox!');
    console.log('Outbox ID:', outboxItem.id);
    console.log('Status:', outboxItem.status);
    console.log('Payload text:\n' + outboxItem.payload.text);
  } else {
    console.error('✘ Failed to find queued Telegram alert in AlertOutbox');
    process.exit(1);
  }

  console.log('5. Checking business branding logo for invoices...');
  const branding = await prisma.businessBranding.findFirst();
  console.log('✔ Branding Business Name:', branding.business_name);
  console.log('✔ Branding Logo Present:', Boolean(branding.logo_url));
  console.log('✔ Logo Preview URL/Length:', branding.logo_url?.slice(0, 50) + '...');
}

test().catch(console.error).finally(() => prisma.$disconnect());
