require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { getSetting } = require('./settings.service');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_PARTNER_CHAT_ID;
const SMS_GATEWAY_URL = process.env.SMS_GATEWAY_URL || process.env.ANDROID_SMS_GATEWAY_URL || 'http://192.168.1.150:8080/v1/sms/send';

// Telegram bot instance
let bot = null;
if (TELEGRAM_BOT_TOKEN && !TELEGRAM_BOT_TOKEN.includes('123456789:ABCDef') && TELEGRAM_BOT_TOKEN !== 'YOUR_TELEGRAM_BOT_TOKEN') {
  try {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
  } catch (err) {
    console.warn('[NotificationEngine] Telegram Bot initialization notice:', err.message);
  }
}

/**
 * Dispatches an alert to the Partners Telegram group with feature-flag gating.
 *
 * @param {string} text - Markdown formatted message text
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendTelegramMessage(text) {
  // Check Dynamic Feature Flag
  if (!getSetting('ENABLE_TELEGRAM_ALERTS', true)) {
    console.log('[NotificationEngine] Telegram alerts are DISABLED via feature flag.');
    return { sent: false, reason: 'FLAG_DISABLED' };
  }

  if (!TELEGRAM_CHAT_ID) {
    console.log('[NotificationEngine] TELEGRAM_CHAT_ID not configured.');
    return { sent: false, reason: 'NO_CHAT_ID' };
  }

  if (!bot) {
    console.log(`[NotificationEngine] [SANDBOX TELEGRAM ALERT]\n${text}`);
    return { sent: true, reason: 'SANDBOX_MOCK' };
  }

  try {
    const res = await bot.sendMessage(TELEGRAM_CHAT_ID, text, { parse_mode: 'Markdown' });
    return { sent: true, messageId: res.message_id };
  } catch (error) {
    console.error('[NotificationEngine] Telegram API error:', error.message);
    return { sent: false, error: error.message };
  }
}

/**
 * Dispatches an SMS via local Android Gateway with feature-flag gating.
 *
 * @param {string} customerPhone - E.164 or local phone string
 * @param {string} receiptText - SMS body
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendSMSReceipt(customerPhone, receiptText) {
  // Check Dynamic Feature Flag
  if (!getSetting('ENABLE_SMS_GATEWAY', false)) {
    console.log('[NotificationEngine] SMS Gateway is DISABLED via feature flag. Skipping SMS dispatch.');
    return { sent: false, reason: 'FLAG_DISABLED' };
  }

  if (!customerPhone) {
    return { sent: false, reason: 'NO_PHONE_NUMBER' };
  }

  try {
    const response = await axios.post(
      SMS_GATEWAY_URL,
      {
        phone: customerPhone,
        phone_number: customerPhone,
        message: receiptText,
      },
      {
        timeout: 3000,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    console.log(`[NotificationEngine] SMS successfully pushed to gateway: ${customerPhone}`);
    return { sent: true, data: response.data };
  } catch (error) {
    console.warn(`[NotificationEngine] Local Android SMS Gateway unavailable at ${SMS_GATEWAY_URL}: ${error.message}`);
    return { sent: false, error: error.message };
  }
}

/**
 * Format and trigger: Job Card Created Alert
 */
async function notifyJobCardCreated({ registration_number, customer_phone, visits, services = [], ticket_number, intake_time }) {
  const serviceList = services.length > 0
    ? services.map((s) => `  • ${s.name || s}`).join('\n')
    : '  • Standard Inspection';

  const timeStr = intake_time ? new Date(intake_time).toLocaleTimeString() : new Date().toLocaleTimeString();

  const message = [
    `🚗 *NEW JOB CARD CREATED (INTAKE)*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🎫 *Ticket:* \`${ticket_number || 'CW-INTAKE'}\``,
    `🚘 *Vehicle:* *${registration_number}*`,
    `🔢 *Total Visits:* ${visits} ${visits > 1 ? '🌟 (Returning Customer)' : '🆕 (First Visit)'}`,
    `📱 *Customer:* ${customer_phone || 'Walk-in'}`,
    `🛠 *Services Assigned:*`,
    serviceList,
    `⏰ *Intake Time:* ${timeStr}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⚡ _Strict 'No-Ticket, No-Work' Verified_`,
  ].join('\n');

  return await sendTelegramMessage(message);
}

/**
 * Format and trigger: Payment Received Alert (with explicit running balance mathematics)
 */
async function notifyPaymentReceived({
  invoice_id,
  registration_number,
  payment_method,
  account_type = 'Cash_Drawer',
  previous_balance = 0,
  amount_received = 0,
  new_balance = 0,
}) {
  const prevStr = Number(previous_balance).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const deltaStr = Number(amount_received).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const newStr = Number(new_balance).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const timeStr = new Date().toLocaleTimeString();

  const message = [
    `💰 *PAYMENT RECEIVED (INFLOW)*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🧾 *Invoice ID:* \`${invoice_id}\``,
    `🚘 *Vehicle:* *${registration_number || 'N/A'}*`,
    `💳 *Payment Method:* *${payment_method}* (\`${account_type}\`)`,
    `───────────────────────────`,
    `📊 *Previous Balance:* Rs. ${prevStr}`,
    `➕ *Amount Received:*  *+Rs. ${deltaStr}*`,
    `📈 *New Ledger Vault:* *Rs. ${newStr}*`,
    `───────────────────────────`,
    `⏰ *Settled At:* ${timeStr}`,
    `🔒 _Guaranteed Atomic Transaction_`,
  ].join('\n');

  return await sendTelegramMessage(message);
}

/**
 * Format and trigger: Expense Recorded Alert (with explicit deduction mathematics)
 */
async function notifyExpenseRecorded({
  category,
  description,
  payment_method = 'Cash',
  account_type = 'Cash_Drawer',
  previous_balance = 0,
  amount_deducted = 0,
  new_balance = 0,
}) {
  const prevStr = Number(previous_balance).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const deltaStr = Number(amount_deducted).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const newStr = Number(new_balance).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const timeStr = new Date().toLocaleTimeString();

  const message = [
    `🔴 *EXPENSE DEDUCTED (OUTFLOW)*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏷 *Category:* *${category || 'General'}*`,
    `📝 *Details:* ${description || 'No description provided'}`,
    `💳 *Paid Via:* *${payment_method}* (\`${account_type}\`)`,
    `───────────────────────────`,
    `📊 *Previous Balance:* Rs. ${prevStr}`,
    `➖ *Amount Deducted:*  *-Rs. ${deltaStr}*`,
    `📉 *Remaining Vault:*  *Rs. ${newStr}*`,
    `───────────────────────────`,
    `⏰ *Recorded At:* ${timeStr}`,
    `⚠️ _Instant Absentee Partner Notification_`,
  ].join('\n');

  return await sendTelegramMessage(message);
}

/**
 * Format and trigger: Low Stock Consumable Alert
 * Prompt: "⚠️ LOW STOCK ALERT: [Item Name] is down to [Amount] [Unit]. Please restock."
 */
async function notifyLowStock({ itemName, amount, unit, threshold }) {
  const message = [
    `⚠️ *LOW STOCK ALERT: CONSUMABLE DEPLETED*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📦 *Consumable:* *${itemName}*`,
    `📉 *Current Stock:* *${amount} ${unit}*`,
    `⚡ *Threshold Alert:* ${threshold} ${unit}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⚠️ LOW STOCK ALERT: ${itemName} is down to ${amount} ${unit}. Please restock.`,
  ].join('\n');

  return await sendTelegramMessage(message);
}

module.exports = {
  sendTelegramMessage,
  sendSMSReceipt,
  notifyJobCardCreated,
  notifyPaymentReceived,
  notifyExpenseRecorded,
  notifyLowStock,
};
