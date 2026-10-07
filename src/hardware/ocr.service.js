require('dotenv').config();
const { createWorker } = require('tesseract.js');
const prisma = require('../prisma');
const { sendTelegramMessage } = require('../services/notification.service');
const EventEmitter = require('events');

// Global event bus for POS live toast / popup notifications
const hardwareEmitter = new EventEmitter();

/**
 * Cleans OCR raw text and extracts the most probable license plate candidate.
 * e.g., "  LEB - 1234  " -> "LEB-1234", "ICT 492" -> "ICT-492"
 *
 * @param {string} rawText
 * @returns {string | null}
 */
function cleanPlateText(rawText) {
  if (!rawText) return null;

  // Filter valid alphanumeric and hyphen characters
  const cleaned = rawText
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, ' ')
    .trim();

  // Pattern: 2-4 Letters followed by 2-5 Digits, or general alphanumeric string 4-10 chars
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const combined = `${words[0]}-${words.slice(1).join('')}`;
    if (/^[A-Z0-9-]{4,10}$/.test(combined)) {
      return combined;
    }
  }

  // Fallback: search for first 4-10 char token
  for (const w of words) {
    if (w.length >= 4 && w.length <= 10) {
      return w;
    }
  }

  return words.join('-').slice(0, 10) || null;
}

/**
 * Runs offline OCR on a saved snapshot using tesseract.js.
 * Zero monthly cloud fees, runs 100% locally on the host machine.
 *
 * @param {string | Buffer} imagePathOrBuffer
 * @returns {Promise<{ rawText: string, plate: string | null, confidence: number }>}
 */
async function recognizePlate(imagePathOrBuffer) {
  let worker = null;
  try {
    worker = await createWorker('eng');
    
    // Whitelist plate characters
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
    });

    const ret = await worker.recognize(imagePathOrBuffer);
    const rawText = ret.data.text.trim();
    const confidence = ret.data.confidence;
    const plate = cleanPlateText(rawText);

    return { rawText, plate, confidence };
  } catch (err) {
    console.error('[OCRService] OCR processing error:', err.message);
    throw err;
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (_) {}
    }
  }
}

/**
 * Executes the VIP Loyalty Loop:
 * 1. Checks if vehicle exists in PostgreSQL
 * 2. If visits >= 5, triggers partner Telegram alert & POS event
 *
 * @param {string} plateNumber
 * @param {string} [snapshotPath]
 * @returns {Promise<{ plate: string, vehicle: any, isVip: boolean }>}
 */
async function processPlateDetection(plateNumber, snapshotPath) {
  if (!plateNumber) {
    return { plate: null, vehicle: null, isVip: false };
  }

  const normalizedPlate = plateNumber.trim().toUpperCase();
  console.log(`[OCRService] Processing license plate: ${normalizedPlate}`);

  let vehicle = null;
  try {
    vehicle = await prisma.vehicle.findUnique({
      where: { registration_number: normalizedPlate },
    });
  } catch (err) {
    console.warn('[OCRService] Database query notice:', err.message);
  }

  const isVip = Boolean(vehicle && vehicle.visits >= 5);

  if (isVip) {
    console.log(`[OCRService] ⭐ VIP CUSTOMER ARRIVED: ${vehicle.registration_number} (Visit #${vehicle.visits + 1})`);

    // 1. Telegram Alert to Partners
    const timeStr = new Date().toLocaleTimeString();
    const vipAlert = [
      `⭐ *VIP CUSTOMER ARRIVAL DETECTED*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🚘 *Vehicle:* *${vehicle.registration_number}*`,
      `👑 *Status:* VIP Patron (Visit #${vehicle.visits + 1})`,
      `📱 *Customer Phone:* ${vehicle.customer_phone}`,
      `🚗 *Make/Model:* ${vehicle.make || ''} ${vehicle.model || ''}`,
      `⏰ *Arrival Time:* ${timeStr}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🔔 _Optical ANPR Camera Entry Trigger_`,
    ].join('\n');

    sendTelegramMessage(vipAlert).catch((err) => {
      console.warn('[OCRService] VIP Telegram alert failed:', err.message);
    });

    // 2. Emit Event to Frontend POS
    hardwareEmitter.emit('vipCustomerArrived', {
      vehicle,
      plate: vehicle.registration_number,
      visits: vehicle.visits + 1,
      snapshotPath,
      timestamp: new Date().toISOString(),
    });
  } else if (vehicle) {
    hardwareEmitter.emit('returningCustomerArrived', {
      vehicle,
      plate: vehicle.registration_number,
      visits: vehicle.visits + 1,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    plate: normalizedPlate,
    vehicle,
    isVip,
  };
}

module.exports = {
  recognizePlate,
  cleanPlateText,
  processPlateDetection,
  hardwareEmitter,
};
