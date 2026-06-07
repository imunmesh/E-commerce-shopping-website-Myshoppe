const db = require('../db');

/**
 * Fetch tracking mode and speed settings dynamically from Neon PostgreSQL.
 * Falls back to environment variables if settings are missing or query fails.
 */
const getSystemSettings = async () => {
  try {
    const res = await db.query('SELECT key, value FROM system_settings');
    const settings = {};
    res.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    const trackingMode = settings['tracking_mode'] || process.env.TRACKING_MODE || 'development';
    const trackingSpeed = settings['tracking_speed'] || (process.env.DEV_FAST_TRACKING === 'true' ? 'demo' : 'normal');

    return {
      trackingMode, // 'development' or 'production'
      trackingSpeed, // 'demo' or 'normal'
      isFastTracking: trackingSpeed === 'demo',
      isProduction: trackingMode === 'production'
    };
  } catch (err) {
    console.error('Error fetching system settings from DB, using env fallbacks:', err);
    const isFastTracking = process.env.DEV_FAST_TRACKING === 'true';
    const isProduction = process.env.TRACKING_MODE === 'production';
    return {
      trackingMode: process.env.TRACKING_MODE || 'development',
      trackingSpeed: isFastTracking ? 'demo' : 'normal',
      isFastTracking,
      isProduction
    };
  }
};

/**
 * Create or update a system setting in database.
 */
const updateSystemSetting = async (key, value) => {
  await db.query(
    `INSERT INTO system_settings (key, value, updated_at) 
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (key) 
     DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
    [key, value]
  );
};

module.exports = {
  getSystemSettings,
  updateSystemSetting
};
