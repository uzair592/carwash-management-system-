const cron = require('node-cron');
function initBackupCron() {
  if (!process.env.BACKUP_PRIMARY_DIR || !process.env.BACKUP_SECONDARY_DIR) {
    console.warn('[Backup] Configure both backup drives before shop use.');
    return;
  }
  const run = () => require('../services/maintenance.service').background(() => require('../../scripts/backup-shop').backupShop()).catch(async e => {
    console.error('[Backup]', e.message);
    await require('../prisma').alertOutbox.create({
      data: {
        type: 'TELEGRAM',
        payload: {
          text: 'Shop backup failed. Check both drives and PostgreSQL tools.'
        }
      }
    }).catch(() => {});
  });
  cron.schedule('0 1 * * *', run, {
    timezone: 'Asia/Karachi'
  });
  run();
}
module.exports = {
  initBackupCron
};
