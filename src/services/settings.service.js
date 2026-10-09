const prisma = require('../prisma');
const EventEmitter = require('events');

// Event bus for dynamic hardware and service lifecycle triggers
const settingsEmitter = new EventEmitter();

// In-memory cache for O(1) synchronous flag evaluations
const settingsCache = new Map();

/**
 * Initializes and refreshes the in-memory settings cache from PostgreSQL.
 * Automatically runs on server startup.
 */
async function initSettings() {
  try {
    const settings = await prisma.systemSetting.findMany();
    settingsCache.clear();
    for (const item of settings) {
      settingsCache.set(item.key, Boolean(item.value));
    }

    // Default fallbacks if database is brand new
    if (!settingsCache.has('ENABLE_SMS_GATEWAY')) {
      settingsCache.set('ENABLE_SMS_GATEWAY', false);
    }
    if (!settingsCache.has('ENABLE_CAMERA_ANPR')) {
      settingsCache.set('ENABLE_CAMERA_ANPR', false);
    }
    if (!settingsCache.has('ENABLE_TELEGRAM_ALERTS')) {
      settingsCache.set('ENABLE_TELEGRAM_ALERTS', true);
    }

    console.log('[SettingsService] Feature flags loaded in memory:', Object.fromEntries(settingsCache));
  } catch (err) {
    console.error('[SettingsService] Failed to load settings from database:', err.message);
    // Ensure in-memory safe defaults even on DB error
    if (!settingsCache.has('ENABLE_SMS_GATEWAY')) settingsCache.set('ENABLE_SMS_GATEWAY', false);
    if (!settingsCache.has('ENABLE_CAMERA_ANPR')) settingsCache.set('ENABLE_CAMERA_ANPR', false);
    if (!settingsCache.has('ENABLE_TELEGRAM_ALERTS')) settingsCache.set('ENABLE_TELEGRAM_ALERTS', true);
  }
}

/**
 * Instant O(1) synchronous lookup of feature flags.
 *
 * @param {string} key - Setting identifier (e.g. 'ENABLE_SMS_GATEWAY')
 * @param {boolean} [defaultValue=false] - Fallback if key is undefined
 * @returns {boolean}
 */
function getSetting(key, defaultValue = false) {
  if (settingsCache.has(key)) {
    return settingsCache.get(key);
  }
  return defaultValue;
}

/**
 * Updates a feature flag in PostgreSQL and updates the memory cache simultaneously.
 *
 * @param {string} key
 * @param {boolean} booleanValue
 * @returns {Promise<{ key: string, value: boolean }>}
 */
async function updateSetting(key, booleanValue) {
  const boolVal = Boolean(booleanValue);

  const updated = await prisma.systemSetting.upsert({
    where: { key },
    update: { value: boolVal },
    create: { key, value: boolVal },
  });

  // Mutate in-memory cache immediately
  settingsCache.set(key, updated.value);

  // Notify hardware controllers and background listeners
  settingsEmitter.emit('settingsUpdated', { key, value: updated.value });

  return { key: updated.key, value: updated.value };
}

/**
 * Returns all feature flags as a plain JavaScript object.
 * @returns {Record<string, boolean>}
 */
function getAllSettings() {
  return Object.fromEntries(settingsCache);
}

module.exports = {
  initSettings,
  getSetting,
  updateSetting,
  getAllSettings,
  settingsEmitter,
};
