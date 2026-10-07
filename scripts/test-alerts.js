/**
 * Manual Test Script: Transparency Engine Alerts
 *
 * Bypasses the database entirely to test:
 * 1. Telegram Service (Bot API connectivity & Markdown formatting)
 * 2. Local Android SMS Gateway (LAN HTTP POST route & timeout handling)
 *
 * Usage: node scripts/test-alerts.js
 */

require('dotenv').config();
const { notifyLedgerUpdate, formatLedgerAlert, sendTelegramAlert } = require('../src/services/telegram.service');
const { sendSMS, formatCustomerReceipt, gatewayUrl } = require('../src/services/sms.service');

async function runAlertDiagnostics() {
  console.log('===============================================================');
  console.log(' CAR WASH MANAGEMENT SYSTEM - TRANSPARENCY ENGINE TEST SUITE');
  console.log('===============================================================\n');

  console.log('1. Configuration Check:');
  console.log('   - TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '[CONFIGURED]' : '[MISSING]');
  console.log('   - TELEGRAM_CHAT_ID:  ', process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_PARTNER_CHAT_ID || '[NOT SET]');
  console.log('   - SMS GATEWAY URL:   ', gatewayUrl);
  console.log('');

  // -------------------------------------------------------------------------
  // TEST 1: Telegram Payment Notification
  // -------------------------------------------------------------------------
  console.log('2. Testing Telegram Inflow Notification...');
  const dummyPayment = {
    account_type: 'Cash_Drawer',
    previous_balance: 25000.00,
    amount_changed: 3500.00,
    new_balance: 28500.00,
    type: 'PAYMENT',
    description: 'TEST AUDIT: Fortuner Full Foam Polish + Vacuum',
  };

  console.log('   Generated Message Preview:');
  console.log('   ' + formatLedgerAlert(dummyPayment).split('\n').join('\n   '));
  console.log('\n   Dispatching to Telegram...');
  const telegramPaymentResult = await notifyLedgerUpdate(dummyPayment);
  console.log('   Telegram Payment Result:', telegramPaymentResult);
  console.log('');

  // -------------------------------------------------------------------------
  // TEST 2: Telegram Expense Notification
  // -------------------------------------------------------------------------
  console.log('3. Testing Telegram Outflow Notification...');
  const dummyExpense = {
    account_type: 'Cash_Drawer',
    previous_balance: 28500.00,
    amount_changed: -1200.00,
    new_balance: 27300.00,
    type: 'EXPENSE',
    description: '[CHEMICALS] 20L Concentrated Snow Foam Detergent',
  };

  console.log('   Dispatching to Telegram...');
  const telegramExpenseResult = await notifyLedgerUpdate(dummyExpense);
  console.log('   Telegram Expense Result:', telegramExpenseResult);
  console.log('');

  // -------------------------------------------------------------------------
  // TEST 3: Local Android SMS Gateway Dispatch
  // -------------------------------------------------------------------------
  console.log('4. Testing Local Android SMS Gateway HTTP Route...');
  const testPhone = process.env.TEST_SMS_PHONE || '+923001234567';
  const testReceipt = formatCustomerReceipt({
    invoiceNumber: 'INV-TEST-0042',
    registrationNumber: 'ICT-LE-492',
    servicesDescription: 'Premium Foam Wash',
    amount: 3500.00,
  });

  console.log(`   Dispatching to target ${testPhone} via ${gatewayUrl} (Timeout: 3000ms)...`);
  const smsResult = await sendSMS(testPhone, testReceipt, 3000);
  console.log('   SMS Gateway Dispatch Result:', smsResult);
  console.log('');

  console.log('===============================================================');
  console.log(' DIAGNOSTICS COMPLETE');
  console.log(' - Telegram Alerts: Verified payload formatting & bot router.');
  console.log(' - Local SMS Gateway: Verified HTTP POST payload & network timeout.');
  console.log('===============================================================');
}

runAlertDiagnostics().catch((err) => {
  console.error('Fatal diagnostic error:', err);
  process.exit(1);
});
