const { getAllSettings, updateSetting, getSetting } = require('../services/settings.service');

/**
 * GET /api/settings
 * Returns all active feature flags
 */
async function getSettingsHandler(req, res, next) {
  try {
    const flags = getAllSettings();
    return res.status(200).json({
      status: 'success',
      data: flags,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/settings
 * Updates a dynamic feature flag
 * Body: { key: string, value: boolean }
 */
async function updateSettingsHandler(req, res, next) {
  try {
    const { key, value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing "key" or "value" in request body.',
      });
    }

    const updated = await updateSetting(key, value);
    return res.status(200).json({
      status: 'success',
      message: `Feature flag "${key}" updated successfully.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSettingsHandler,
  updateSettingsHandler,
};
