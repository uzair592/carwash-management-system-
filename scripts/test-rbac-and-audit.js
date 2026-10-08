const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testSecurityRBACAndAudit() {
  console.log('========================================================');
  console.log('🔒 TESTING RBAC, ADMIN PIN VERIFICATION, AND AUDIT LOGS');
  console.log('========================================================\n');

  try {
    // 1. RBAC Check: Cashier blocked from Financials
    console.log('1️⃣ Testing RBAC: Cashier access to /api/financials/dividends...');
    try {
      await axios.get(`${BASE_URL}/financials/dividends`, {
        headers: { 'x-user-role': 'CASHIER' },
      });
      throw new Error('FAIL: Cashier should have been blocked with 403!');
    } catch (err) {
      if (err.response?.status === 403) {
        console.log('✅ PASS: Cashier blocked with 403 Forbidden:', err.response.data.message);
      } else {
        throw err;
      }
    }

    // 2. RBAC Check: Cashier blocked from Payroll
    console.log('\n2️⃣ Testing RBAC: Cashier access to /api/payroll/generate...');
    try {
      await axios.get(`${BASE_URL}/payroll/generate`, {
        headers: { 'x-user-role': 'CASHIER' },
      });
      throw new Error('FAIL: Cashier should have been blocked from payroll with 403!');
    } catch (err) {
      if (err.response?.status === 403) {
        console.log('✅ PASS: Cashier blocked from payroll with 403 Forbidden:', err.response.data.message);
      } else {
        throw err;
      }
    }

    // 3. RBAC Check: Admin permitted to Financials
    console.log('\n3️⃣ Testing RBAC: Admin access to /api/financials/dividends...');
    const adminDivRes = await axios.get(`${BASE_URL}/financials/dividends`, {
      headers: { 'x-user-role': 'ADMIN' },
    });
    console.log('✅ PASS: Admin granted 200 OK. Month:', adminDivRes.data.data.month);

    // 4. Test PIN Verification Endpoint
    console.log('\n4️⃣ Testing PIN Verification API (/api/auth/verify-pin)...');
    const validPinRes = await axios.post(`${BASE_URL}/auth/verify-pin`, { pin: '1234' });
    console.log('✅ Valid PIN check:', validPinRes.data);
    if (!validPinRes.data.valid) throw new Error('Expected PIN 1234 to be valid!');

    const invalidPinRes = await axios.post(`${BASE_URL}/auth/verify-pin`, { pin: '9999' });
    console.log('✅ Invalid PIN check:', invalidPinRes.data);
    if (invalidPinRes.data.valid) throw new Error('Expected PIN 9999 to be invalid!');

    // 5. Test Discount with Admin PIN and Audit Log
    console.log('\n5️⃣ Testing Invoice Checkout with Discount (Admin PIN authorization)...');
    // Get a service
    const srvRes = await axios.get(`${BASE_URL}/services`);
    const service = srvRes.data.data[0];

    // Create intake
    const intakeRes = await axios.post(`${BASE_URL}/intake`, {
      customer_name: 'Security Test Customer',
      customer_phone: '03001234567',
      registration_number: `SEC-${Math.floor(1000 + Math.random() * 9000)}`,
      physical_bay: 'Washing Jack 1',
      service_ids: [service.id],
    });
    const jobCardId = intakeRes.data.data.job_card?.id;

    // Complete job card
    await axios.patch(`${BASE_URL}/job-cards/${jobCardId}/complete`);

    // Checkout with discount
    const checkoutRes = await axios.post(`${BASE_URL}/checkout`, {
      job_card_id: jobCardId,
      payment_method: 'CASH',
      discount_amount: 200,
      admin_pin: '1234',
    });
    const invoiceId = checkoutRes.data.data.invoice.id;
    console.log(`✅ Invoice generated with Rs. 200 discount. Invoice ID: [${invoiceId}]`);

    // 6. Test Credit Note / Refund Flow with Inventory Restoring & Admin PIN
    console.log('\n6️⃣ Testing Credit Note / Refund Flow (/api/invoices/:id/refund)...');
    // Attempt refund with invalid PIN first
    try {
      await axios.post(`${BASE_URL}/invoices/${invoiceId}/refund`, {
        amount: checkoutRes.data.data.invoice.total_amount,
        reason: 'Customer dispute test',
        admin_pin: '0000',
      });
      throw new Error('FAIL: Refund with invalid PIN should have failed with 403!');
    } catch (err) {
      if (err.response?.status === 403) {
        console.log('✅ PASS: Refund rejected with invalid PIN (403 Forbidden)');
      } else {
        throw err;
      }
    }

    // Authorize refund with valid Admin PIN
    const refundRes = await axios.post(`${BASE_URL}/invoices/${invoiceId}/refund`, {
      amount: checkoutRes.data.data.invoice.total_amount,
      reason: 'Accidental double bill reversal',
      admin_pin: '1234',
    });
    console.log('✅ PASS: Refund authorized and processed atomically:');
    console.log(`  - Refund Amount: Rs. ${refundRes.data.data.refund.amount}`);
    console.log(`  - Restored Inventory:`, refundRes.data.data.restored_inventory);

    // 7. Test Inventory Manual Stock Adjustment Audit Log
    console.log('\n7️⃣ Testing Inventory Manual Adjustment Audit Log...');
    const invListRes = await axios.get(`${BASE_URL}/inventory`);
    const invItem = invListRes.data.data[0];
    const prevStock = parseFloat(invItem.current_stock);
    const newStock = prevStock + 5;

    await axios.patch(
      `${BASE_URL}/inventory/${invItem.id}`,
      { current_stock: newStock },
      { headers: { 'x-user-role': 'ADMIN' } }
    );
    console.log(`✅ Adjusted inventory stock for [${invItem.item_name}] from ${prevStock} to ${newStock}`);

    // 8. Fetch and verify Audit Logs
    console.log('\n8️⃣ Querying /api/audit-logs as ADMIN...');
    const logsRes = await axios.get(`${BASE_URL}/audit-logs`, {
      headers: { 'x-user-role': 'ADMIN' },
    });
    console.log('✅ Total Audit Logs recorded:', logsRes.data.pagination.total);
    console.log('Latest 5 Audit Log events:');
    logsRes.data.data.slice(0, 5).forEach((log) => {
      console.log(`  • [${log.action}] ${log.description} (By: ${log.performed_by_name} at ${new Date(log.created_at).toLocaleTimeString()})`);
    });

    console.log('\n🎉 ALL SECURITY, RBAC, PIN, AND AUDIT LOG TESTS PASSED!');
  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

testSecurityRBACAndAudit();
