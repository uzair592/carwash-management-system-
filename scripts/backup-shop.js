require('dotenv').config();
const fs = require('fs/promises'),
  path = require('path'),
  crypto = require('crypto');
const {
  spawn
} = require('child_process');
function databaseEnv(url) {
  const d = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(d.protocol)) throw new Error('PostgreSQL connection URL required.');
  return {
    ...process.env,
    PGHOST: d.hostname,
    PGPORT: d.port || '5432',
    PGUSER: decodeURIComponent(d.username),
    PGPASSWORD: decodeURIComponent(d.password),
    PGDATABASE: decodeURIComponent(d.pathname.slice(1))
  };
}
async function run(binary, args, env) {
  await new Promise((resolve, reject) => {
    const p = spawn(binary, args, {
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true
    });
    let error = '';
    p.stderr.on('data', b => {
      error += b.toString();
    });
    p.on('error', reject);
    p.on('exit', code => code === 0 ? resolve() : reject(new Error('PostgreSQL backup/restore command failed (' + code + ').')));
  });
}
async function files(directory) {
  let result = [];
  for (const entry of await fs.readdir(directory, {
    withFileTypes: true
  })) {
    const p = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Backups must not contain symbolic links.');
    if (entry.isDirectory()) result.push(...(await files(p)));else result.push(p);
  }
  return result;
}
async function checksum(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of require('fs').createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function verifyBackup(directory) {
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  for (const [relative, hash] of Object.entries(manifest.files)) {
    const file = path.resolve(directory, relative);
    if (!file.startsWith(path.resolve(directory) + path.sep)) throw new Error('Unsafe backup manifest.');
    if ((await checksum(file)) !== hash) throw new Error('Backup checksum mismatch: ' + relative);
  }
  return manifest;
}
async function backupShop() {
  const primary = path.resolve(process.env.BACKUP_PRIMARY_DIR || ''),
    secondary = path.resolve(process.env.BACKUP_SECONDARY_DIR || '');
  if (!process.env.BACKUP_PRIMARY_DIR || !process.env.BACKUP_SECONDARY_DIR || primary === secondary || primary.startsWith(secondary + path.sep) || secondary.startsWith(primary + path.sep)) throw new Error('Configure two separate backup directories.');
  const day = require('../src/utils/business-time').dayKey();
  const name = 'dfpro-' + day + '-' + Date.now(),
    destination = path.join(primary, name),
    root = path.resolve(__dirname, '..');
  await fs.mkdir(destination, {
    recursive: true,
    mode: 0o700
  });
  try {
    await run(process.env.PG_DUMP_BIN || 'pg_dump', ['-Fc', '--file', path.join(destination, 'database.dump')], databaseEnv(process.env.DATABASE_URL));
    for (const folder of ['public/uploads', 'private']) {
      try {
        const source = folder === 'private' ? process.env.PRIVATE_DATA_DIR || path.join(root, folder) : path.join(root, folder);
        await fs.access(source);
        await fs.cp(source, path.join(destination, folder), {
          recursive: true
        });
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
    const manifest = {
      version: 1,
      created_at: new Date().toISOString(),
      files: {}
    };
    for (const file of await files(destination)) manifest.files[path.relative(destination, file).split(path.sep).join('/')] = await checksum(file);
    await fs.writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await verifyBackup(destination);
    await fs.mkdir(secondary, {
      recursive: true,
      mode: 0o700
    });
    const copy = path.join(secondary, name);
    await fs.cp(destination, copy, {
      recursive: true
    });
    await verifyBackup(copy);
    for (const directory of [primary, secondary]) for (const entry of await fs.readdir(directory)) {
      if (!/^dfpro-\d{4}-\d{2}-\d{2}-\d+$/.test(entry)) continue;
      const full = path.join(directory, entry),
        stat = await fs.stat(full);
      if (stat.mtimeMs < Date.now() - 14 * 86400000) await fs.rm(full, {
        recursive: true
      });
    }
    return {
      primary: destination,
      secondary: copy
    };
  } catch (e) {
    await fs.writeFile(path.join(destination, 'FAILED'), e.message);
    throw e;
  }
}
if (require.main === module) backupShop().then(() => console.log('Verified shop backup saved to both configured destinations.')).catch(e => {
  console.error(e.message);
  process.exitCode = 1;
});
module.exports = {
  backupShop,
  verifyBackup,
  databaseEnv,
  run
};
