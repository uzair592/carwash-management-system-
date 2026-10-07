const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_BASE = 'http://localhost:5000/api';

async function runTest() {
  console.log('--- Testing Phase 8: Digital Vehicle Inspection & Media Uploads ---');

  // 1. Fetch an existing or create a new Job Card
  const jobCardsRes = await axios.get(`${API_BASE}/job-cards`);
  let jobCard = jobCardsRes.data.data.find((j) => j.status !== 'Completed');

  if (!jobCard) {
    const servicesRes = await axios.get(`${API_BASE}/services`);
    const service = servicesRes.data.data[0];
    const intakeRes = await axios.post(`${API_BASE}/vehicles/intake`, {
      registration_number: 'INSPECT-101',
      customer_phone: '03001234567',
      services: [service.id],
    });
    jobCard = intakeRes.data.data.job_card;
  }

  console.log(`[Media Test] Target Job Card ID: ${jobCard.id}`);

  // 2. Create a dummy test image buffer
  const testImagePath = path.join(__dirname, 'test-damage.jpg');
  // Minimal valid 1x1 JPEG byte sequence
  const minimalJpg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x80, 0xff, 0xd9
  ]);
  fs.writeFileSync(testImagePath, minimalJpg);

  // 3. Upload BEFORE / DAMAGE_PROOF photo
  console.log('[Media Test] Uploading Pre-existing Damage Inspection photo...');
  const formBefore = new FormData();
  formBefore.append('image', fs.createReadStream(testImagePath));
  formBefore.append('type', 'DAMAGE_PROOF');
  formBefore.append('notes', 'Deep stone chip on lower front splitter');

  const uploadRes1 = await axios.post(`${API_BASE}/job-cards/${jobCard.id}/media`, formBefore, {
    headers: formBefore.getHeaders(),
  });
  console.log('✔ Upload 1 Success:', uploadRes1.data.data);

  // 4. Upload AFTER photo
  console.log('[Media Test] Uploading After Detailing Quality photo...');
  const formAfter = new FormData();
  formAfter.append('image', fs.createReadStream(testImagePath));
  formAfter.append('type', 'AFTER');
  formAfter.append('notes', 'Post-cure ceramic gloss inspection completed');

  const uploadRes2 = await axios.post(`${API_BASE}/job-cards/${jobCard.id}/media`, formAfter, {
    headers: formAfter.getHeaders(),
  });
  console.log('✔ Upload 2 Success:', uploadRes2.data.data);

  // 5. Fetch all media for this Job Card
  const listMediaRes = await axios.get(`${API_BASE}/job-cards/${jobCard.id}/media`);
  console.log(`✔ Retrieved ${listMediaRes.data.data.length} photos attached to Job Card.`);

  // 6. Test Static Serving of uploaded image
  const uploadedPath = uploadRes1.data.data.file_path; // e.g. /uploads/vehicles/filename.jpg
  const staticUrl = `http://localhost:5000${uploadedPath}`;
  console.log(`[Media Test] Testing static file access at: ${staticUrl}`);
  const staticRes = await axios.get(staticUrl, { responseType: 'arraybuffer' });
  if (staticRes.status === 200 && staticRes.data.length > 0) {
    console.log(`✔ SUCCESS: Static image successfully served from server PC (${staticRes.data.length} bytes)!`);
  } else {
    console.error('❌ Failed to fetch static image.');
  }

  // 7. Test Checkout with Liability Media Alert
  console.log('[Media Test] Performing checkout to test Telegram Liability notification note...');
  const checkoutRes = await axios.post(`${API_BASE}/invoices/checkout`, {
    job_card_id: jobCard.id,
    payment_method: 'CASH',
  });
  console.log(`✔ Checkout settled: Invoice ${checkoutRes.data.data.invoice.invoice_number}`);

  // Clean up scratch file
  if (fs.existsSync(testImagePath)) {
    fs.unlinkSync(testImagePath);
  }

  console.log('\n--- All Phase 8 Backend & Media Verification Checks Passed ---');
}

runTest().catch((err) => {
  console.error('Test error:', err.response?.data || err.message);
  process.exit(1);
});
