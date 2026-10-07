require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_PARTNER_CHAT_ID;

// Initialize bot without polling since this service primarily dispatches outbound alerts
let bot = null;
if (token && token !== 'YOUR_TELEGRAM_BOT_TOKEN' && !token.includes('123456789:ABCDef')) {
  try {
    bot = new TelegramBot(token, { polling: false });
  } catch (err) {
    console.warn('[TelegramService] Warning: Failed to initialize Telegram Bot instance:', err.message);
  }
} else {
  console.log('[TelegramService] Initialized in sandbox/dry-run mode (Valid TELEGRAM_BOT_TOKEN not configured).');
}

/**
 * Formats ledger balance payloads into human-readable alerts for partner groups.
 *
 * @param {Object} payload
 * @param {string} payload.account_type - 'Cash_Drawer' | 'Main_Bank'
 * @param {number} payload.previous_balance - Balance prior to transaction
 * @param {number} payload.amount_changed - Delta (positive for income, negative for expense)
 * @param {number} payload.new_balance - Resulting balance
 * @param {string} [payload.type] - 'PAYMENT' | 'EXPENSE'
 * @param {string} [payload.description] - Transaction description or invoice/category note
 * @returns {string} Formatted Markdown string
 */
function formatLedgerAlert(payload) {
  const {
    account_type = 'Cash_Drawer',
    previous_balance = 0,
    amount_changed = 0,
    new_balance = 0,
    type,
    description = 'Standard Ledger Transaction',
  } = payload;

  const isPayment = type ? type.toUpperCase() === 'PAYMENT' : amount_changed >= 0;
  const absAmount = Math.abs(amount_changed);
  const formattedPrevious = Number(previous_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedNew = Number(new_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedDelta = Number(absAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const timestamp = new Date().toLocaleString('en-US', { hour12: true });

  if (isPayment) {
    return [
      `💰 *CASH INFLOW / PAYMENT RECORDED*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🏦 *Account:* \`${account_type}\``,
      `💵 *Amount Credited:* \`+Rs. ${formattedDelta}\``,
      `📊 *Previous Balance:* Rs. ${formattedPrevious}`,
      `📈 *Current Vault Balance:* *Rs. ${formattedNew}*`,
      `📝 *Notes:* ${description}`,
      `⏰ *Logged At:* ${timestamp}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🔒 _Verified by Immutable Ledger Audit_`,
    ].join('\n');
  } else {
    return [
      `🔴 *EXPENSE OUTFLOW RECORDED*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🏦 *Account:* \`${account_type}\``,
      `💸 *Amount Debited:* \`-Rs. ${formattedDelta}\``,
      `📊 *Previous Balance:* Rs. ${formattedPrevious}`,
      `📉 *Current Vault Balance:* *Rs. ${formattedNew}*`,
      `📝 *Category/Notes:* ${description}`,
      `⏰ *Logged At:* ${timestamp}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚠️ _Instant Absentee Partner Notification_`,
    ].join('\n');
  }
}

/**
 * Dispatches a raw text message to the partners' Telegram group.
 *
 * @param {string} text - Message text
 * @param {string} [targetChatId] - Optional override for destination chat
 * @returns {Promise<{ success: boolean, messageId?: number, error?: string }>}
 */
async function sendTelegramAlert(text, targetChatId = chatId) {
  if (!targetChatId) {
    const msg = '[TelegramService] Cannot send alert: No TELEGRAM_CHAT_ID defined.';
    console.warn(msg);
    return { success: false, error: msg };
  }

  if (!bot) {
    console.log(`[TelegramService] [MOCK SEND] Chat ID: ${targetChatId}\n${text}`);
    return { success: true, mocked: true };
  }

  try {
    const sent = await bot.sendMessage(targetChatId, text, { parse_mode: 'Markdown' });
    console.log(`[TelegramService] Alert successfully sent to Telegram (Msg ID: ${sent.message_id}).`);
    return { success: true, messageId: sent.message_id };
  } catch (error) {
    console.error('[TelegramService] Error sending alert to Telegram:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Convenience helper: formats and dispatches a ledger update event.
 *
 * @param {Object} ledgerPayload - { previous_balance, amount_changed, new_balance, account_type, type, description }
 * @returns {Promise<{ success: boolean, messageId?: number, error?: string }>}
 */
async function notifyLedgerUpdate(ledgerPayload) {
  const formattedText = formatLedgerAlert(ledgerPayload);
  return await sendTelegramAlert(formattedText);
}

module.exports = {
  formatLedgerAlert,
  sendTelegramAlert,
  notifyLedgerUpdate,
};
