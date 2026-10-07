require('dotenv').config();

const DEFAULT_GATEWAY_URL = 'http://192.168.1.150:8080/v1/sms/send';
const gatewayUrl = process.env.ANDROID_SMS_GATEWAY_URL || DEFAULT_GATEWAY_URL;
const apiKey = process.env.ANDROID_SMS_API_KEY || null;

/**
 * Dispatches an SMS receipt or notification via the local network Android SMS Gateway.
 *
 * @param {string} phoneNumber - Recipient mobile phone number
 * @param {string} message - Text message content
 * @param {number} [timeoutMs=5000] - Request timeout in milliseconds
 * @returns {Promise<{ success: boolean, data?: any, error?: string }>}
 */
async function sendSMS(phoneNumber, message, timeoutMs = 5000) {
  if (!phoneNumber || !message) {
    const errorMsg = '[SMSService] Both "phoneNumber" and "message" are required.';
    console.warn(errorMsg);
    return { success: false, error: errorMsg };
  }

  const cleanPhone = String(phoneNumber).trim();
  const cleanMessage = String(message).trim();

  const payload = {
    phone_number: cleanPhone,
    to: cleanPhone,
    message: cleanMessage,
  };

  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[SMSService] Local SMS Gateway returned status ${response.status}: ${errText}`);
      return { success: false, error: `Gateway status ${response.status}: ${errText}` };
    }

    let resJson;
    try {
      resJson = await response.json();
    } catch {
      resJson = { status: 'sent' };
    }

    console.log(`[SMSService] SMS dispatched to ${cleanPhone} via local gateway.`);
    return { success: true, data: resJson };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn(`[SMSService] Timeout (${timeoutMs}ms) reaching local Android SMS Gateway at ${gatewayUrl}`);
      return { success: false, error: `Request timed out after ${timeoutMs}ms` };
    }
    console.warn(`[SMSService] Local SMS Gateway connection error (${gatewayUrl}):`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generates a clean, professional customer receipt text message.
 *
 * @param {Object} details
 * @param {string} details.invoiceNumber
 * @param {string} details.registrationNumber
 * @param {string} details.servicesDescription
 * @param {number} details.amount
 * @returns {string}
 */
function formatCustomerReceipt({ invoiceNumber, registrationNumber, servicesDescription, amount }) {
  const formattedAmount = Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
  return (
    `[CAR WASH & DETAILING]\n` +
    `Inv: ${invoiceNumber || 'N/A'}\n` +
    `Vehicle: ${registrationNumber || 'N/A'}\n` +
    `Service: ${servicesDescription || 'Car Wash Service'}\n` +
    `Paid: Rs. ${formattedAmount}\n` +
    `Thank you for your business!`
  );
}

module.exports = {
  sendSMS,
  formatCustomerReceipt,
  gatewayUrl,
};
