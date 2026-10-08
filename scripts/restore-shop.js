require('dotenv').config();
const path = require('path'),
  fs = require('fs/promises');
const {
  verifyBackup,
  databaseEnv,
  run
} = require('./backup-shop');
async function restore() {
  const directory = process.argv[2];
  if (!directory || !process.argv.includes('--confirm-replace') || !process.env.RESTORE_DATABASE_URL) throw new Error('Stop the app, set RESTORE_DATABASE_URL, and run restore-shop.js BACKUP_DIRECTORY --confirm-replace. This replaces the target database and shop files.');
  await verifyBackup(directory);
  await run(process.env.PG_RESTORE_BIN || 'pg_restore', ['--clean', '--if-exists', '--no-owner', '--exit-on-error', '--dbname', new URL(process.env.RESTORE_DATABASE_URL).pathname.slice(1), path.join(directory, 'database.dump')], databaseEnv(process.env.RESTORE_DATABASE_URL));
  for (const folder of ['public/uploads', 'private']) {
    const source = path.join(directory, folder);
    try {
      await fs.access(source);
      await fs.cp(source, folder === 'private' ? process.env.PRIVATE_DATA_DIR || path.join(__dirname, '..', folder) : path.join(__dirname, '..', folder), {
        recursive: true
      });
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  console.log('Verified backup restored. Regenerate Prisma client and start the shop app.');
}
if (require.main === module) restore().catch(e => {
  console.error(e.message);
  process.exitCode = 1;
});
module.exports = {
  restore
};
