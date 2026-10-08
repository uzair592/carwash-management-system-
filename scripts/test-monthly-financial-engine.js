const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testMonthlyFinancialEngine() {
  console.log('========================================================');
  console.log('🚀 TESTING MONTHLY FINANCIAL ENGINE (YIELD, PAYROLL, EQUITY)');
  console.log('========================================================\n');

  try {
    // 1. Test Partner Equity
    console.log('1️⃣ Testing GET /api/financials/equity...');
    const equityRes = await axios.get(`${BASE_URL}/financials/equity`);
    console.log('✅ Status:', equityRes.data.status);
    console.log('Partners count:', equityRes.data.data.length);
    equityRes.data.data.forEach((p) => {
      console.log(`  - ${p.partner_name}: ${p.equity_percentage}% (Phone: ${p.phone || 'N/A'})`);
    });
    if (equityRes.data.data.length < 3) throw new Error('Expected at least 3 seeded partners!');

    // 2. Test Yield Mappings
    console.log('\n2️⃣ Testing GET /api/inventory/yield-mappings...');
    const yieldRes = await axios.get(`${BASE_URL}/inventory/yield-mappings`);
    console.log('✅ Status:', yieldRes.data.status);
    console.log('Mappings count:', yieldRes.data.data.length);
    yieldRes.data.data.forEach((m) => {
      console.log(`  - Service [${m.service?.name}] -> Consumable [${m.inventory?.item_name}]: ${m.deduction_amount} ${m.inventory?.unit_type}`);
    });

    // 3. Test Staff Payroll Service
    const currentMonth = new Date().toISOString().slice(0, 7);
    console.log(`\n3️⃣ Testing GET /api/financials/payroll?month=${currentMonth}...`);
    const payrollRes = await axios.get(`${BASE_URL}/financials/payroll?month=${currentMonth}`);
    console.log('✅ Status:', payrollRes.data.status);
    console.log('Payroll Summary:', payrollRes.data.data.summary);
    console.log('Staff Breakdown:');
    payrollRes.data.data.payroll.forEach((s) => {
      console.log(`  - ${s.name} (${s.role}): Base=Rs.${s.base_salary}, Jobs=${s.completed_jobs_count}, Comm=Rs.${s.commissions_earned} (${s.commission_mode}), Total=Rs.${s.total_payout}`);
    });

    // 4. Test Partner Profit Split & Dividends
    console.log(`\n4️⃣ Testing GET /api/financials/dividends?month=${currentMonth}...`);
    const divRes = await axios.get(`${BASE_URL}/financials/dividends?month=${currentMonth}`);
    console.log('✅ Status:', divRes.data.status);
    const summary = divRes.data.data.summary;
    console.log('P&L Waterfall:');
    console.log(`  - Gross Revenue: Rs. ${summary.gross_revenue}`);
    console.log(`  - Total Expenses: Rs. ${summary.total_expenses}`);
    console.log(`  - Total Payroll: Rs. ${summary.total_payroll}`);
    console.log(`  - Consumables COGS: Rs. ${summary.cogs}`);
    console.log(`  - Net Distributable Profit: Rs. ${summary.net_distributable_profit} (Margin: ${summary.profit_margin_percent}%)`);
    console.log('Partner Dividends:');
    divRes.data.data.partners.forEach((p) => {
      console.log(`  - ${p.partner_name} (${p.equity_percentage}%): Rs. ${p.dividend_amount}`);
    });

    // 5. Test Telegram Dispatch for Dividends
    console.log('\n5️⃣ Testing POST /api/financials/dividends/dispatch...');
    const dispatchRes = await axios.post(`${BASE_URL}/financials/dividends/dispatch`, { month: currentMonth });
    console.log('✅ Dispatch Status:', dispatchRes.data.status);
    console.log('Message:', dispatchRes.data.message);
    console.log('Outbox ID:', dispatchRes.data.data?.outbox?.id);

    // 6. Test Inventory Deduction on Checkout
    console.log('\n6️⃣ Testing Checkout Atomic Inventory Deduction & Telegram Low-Stock Alert...');
    // Fetch Ceramic Coating service
    const srvRes = await axios.get(`${BASE_URL}/services`);
    const ceramicService = srvRes.data.data.find((s) => s.name.toLowerCase().includes('ceramic')) || srvRes.data.data[0];
    
    // Check initial inventory
    const invResBefore = await axios.get(`${BASE_URL}/inventory`);
    const ceramicItemBefore = invResBefore.data.data.find((i) => i.item_name.toLowerCase().includes('ceramic')) || invResBefore.data.data[0];
    console.log(`Initial stock of [${ceramicItemBefore.item_name}]: ${ceramicItemBefore.current_stock} ${ceramicItemBefore.unit_type}`);

    // Create rapid intake
    const intakeRes = await axios.post(`${BASE_URL}/intake`, {
      customer_name: 'Financial Engine Test',
      customer_phone: '03009999999',
      registration_number: `TST-${Math.floor(1000 + Math.random() * 9000)}`,
      physical_bay: 'Detailing Center',
      service_ids: [ceramicService.id],
    });
    const jobCardId = intakeRes.data.data.job_card?.id || intakeRes.data.data.jobCard?.id;
    console.log(`Created JobCard [${jobCardId}] for bay [Detailing Center]`);

    // Complete job card
    await axios.patch(`${BASE_URL}/job-cards/${jobCardId}/complete`);
    console.log(`Completed JobCard [${jobCardId}]`);

    // Checkout
    const checkoutRes = await axios.post(`${BASE_URL}/checkout`, {
      job_card_id: jobCardId,
      payment_method: 'CASH',
      amount_paid: ceramicService.base_price,
    });
    console.log(`✅ Checkout completed. Invoice ID: [${checkoutRes.data.data.invoice.id}]`);

    // Verify inventory deducted
    const invResAfter = await axios.get(`${BASE_URL}/inventory`);
    const ceramicItemAfter = invResAfter.data.data.find((i) => i.id === ceramicItemBefore.id);
    console.log(`Stock after checkout for [${ceramicItemAfter.item_name}]: ${ceramicItemAfter.current_stock} ${ceramicItemAfter.unit_type}`);
    console.log(`Deduction: ${ceramicItemBefore.current_stock - ceramicItemAfter.current_stock} ${ceramicItemAfter.unit_type}`);

    console.log('\n🎉 ALL MONTHLY FINANCIAL ENGINE TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

testMonthlyFinancialEngine();
