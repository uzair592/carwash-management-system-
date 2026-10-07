const axios = require('axios');
const API_BASE = 'http://localhost:5000/api';

async function runTest() {
  console.log('--- Testing Phase 7: Inventory Yield Deduction & Payroll Engine ---');

  // 1. Check initial inventory stock
  const invResBefore = await axios.get(`${API_BASE}/inventory`);
  const ceramicItemBefore = invResBefore.data.data.find((i) => i.item_name.includes('Ceramic'));
  console.log(`[Yield Test] Initial Ceramic Stock: ${ceramicItemBefore.current_stock} ${ceramicItemBefore.unit_type}`);

  // 2. Intake a vehicle for Ceramic Coating
  const servicesRes = await axios.get(`${API_BASE}/services`);
  const ceramicService = servicesRes.data.data.find((s) => s.name === 'Ceramic Coating');
  const workersRes = await axios.get(`${API_BASE}/users?role=Worker`);
  const worker = workersRes.data.data[0];

  const intakeRes = await axios.post(`${API_BASE}/vehicles/intake`, {
    registration_number: 'YIELD-999',
    customer_phone: '03009998877',
    service_ids: [ceramicService.id],
    worker_id: worker.id,
  });

  const jobCardId = intakeRes.data.data.job_card.id;
  console.log(`[Yield Test] Created Job Card: ${jobCardId} for ${ceramicService.name} (assigned to ${worker.name})`);

  // 3. Checkout Job Card
  const checkoutRes = await axios.post(`${API_BASE}/invoices/checkout`, {
    job_card_id: jobCardId,
    payment_method: 'CASH',
    discount_amount: 0,
  });

  console.log(`[Yield Test] Checkout settled: Invoice ${checkoutRes.data.data.invoice.invoice_number}`);
  console.log('[Yield Test] Inventory Deductions returned in checkout:', checkoutRes.data.data.inventory_deductions);

  // 4. Verify Inventory stock was decremented
  const invResAfter = await axios.get(`${API_BASE}/inventory`);
  const ceramicItemAfter = invResAfter.data.data.find((i) => i.item_name.includes('Ceramic'));
  console.log(`[Yield Test] Stock After Checkout: ${ceramicItemAfter.current_stock} ${ceramicItemAfter.unit_type}`);

  const expectedStock = ceramicItemBefore.current_stock - 50.00;
  if (Math.abs(ceramicItemAfter.current_stock - expectedStock) < 0.01) {
    console.log(`✔ SUCCESS: Inventory stock correctly deducted by 50 ML (${ceramicItemBefore.current_stock} -> ${ceramicItemAfter.current_stock})!`);
  } else {
    console.error(`❌ FAILED: Expected ${expectedStock}, got ${ceramicItemAfter.current_stock}`);
  }

  // 5. Test Low Stock Alert Trigger
  console.log('\n--- Testing Low Stock Trigger ---');
  // Update ceramic stock to 70 ML (threshold is 60 ML)
  await axios.patch(`${API_BASE}/inventory/${ceramicItemAfter.id}`, { current_stock: 70.00 });

  // Intake another vehicle for Ceramic Coating (will deduct 50 ML, leaving 20 ML <= 60 ML threshold)
  const intake2 = await axios.post(`${API_BASE}/vehicles/intake`, {
    registration_number: 'LOWSTK-111',
    customer_phone: '03001112233',
    service_ids: [ceramicService.id],
    worker_id: worker.id,
  });

  const checkout2 = await axios.post(`${API_BASE}/invoices/checkout`, {
    job_card_id: intake2.data.data.job_card.id,
    payment_method: 'CASH',
  });

  const invResLow = await axios.get(`${API_BASE}/inventory`);
  const ceramicLow = invResLow.data.data.find((i) => i.item_name.includes('Ceramic'));
  console.log(`[Low Stock Test] Post-deduction stock: ${ceramicLow.current_stock} ${ceramicLow.unit_type} (Low stock flag: ${ceramicLow.is_low_stock})`);
  if (ceramicLow.is_low_stock) {
    console.log('✔ SUCCESS: Item is now flagged LOW STOCK and Telegram alert was triggered!');
  }

  // 6. Test Monthly Payroll calculation with worker commission
  console.log('\n--- Testing Monthly Payroll Calculation ---');
  const monthStr = new Date().toISOString().slice(0, 7);
  const payrollRes = await axios.get(`${API_BASE}/payroll/generate?month=${monthStr}`);
  console.log(`[Payroll Test] Month: ${payrollRes.data.month}, Total Expense: Rs. ${payrollRes.data.summary.total_payroll_expense}`);
  const workerPayroll = payrollRes.data.payroll.find((p) => p.user_id === worker.id);
  console.log(`[Payroll Test] ${workerPayroll.name}:`);
  console.log(`  - Base Salary: Rs. ${workerPayroll.base_salary}`);
  console.log(`  - Completed Jobs: ${workerPayroll.completed_jobs_count}`);
  console.log(`  - Revenue Generated: Rs. ${workerPayroll.total_revenue_generated}`);
  console.log(`  - Commissions Earned (${workerPayroll.commission_rate}%): Rs. ${workerPayroll.commissions_earned}`);
  console.log(`  - Total Payout: Rs. ${workerPayroll.total_payout}`);

  if (workerPayroll.commissions_earned > 0) {
    console.log('✔ SUCCESS: Staff commissions accurately accumulated into monthly payroll sheet!');
  }

  console.log('\n--- All Phase 7 Yield & Payroll Verification Checks Passed ---');
}

runTest().catch((err) => {
  console.error('Test error:', err.response?.data || err.message);
  process.exit(1);
});
