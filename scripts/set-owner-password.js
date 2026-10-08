// Local operator recovery; no unauthenticated HTTP recovery endpoint.
require('dotenv').config();
const prisma = require('../src/prisma');
const {
  hashSecret
} = require('../src/utils/security');
async function main() {
  const name = process.env.SHOP_ADMIN_NAME;
  const password = process.env.SHOP_ADMIN_PASSWORD;
  const pin = process.env.SHOP_ADMIN_PIN;
  if (!process.argv.includes('--confirm-reset') || !name || !password || password.length < 12 || !/^\d{4,8}$/.test(pin || '')) throw new Error('Set SHOP_ADMIN_NAME, SHOP_ADMIN_PASSWORD (12+ characters), SHOP_ADMIN_PIN (4–8 digits), and pass --confirm-reset.');
  const owners = await prisma.user.findMany({
    where: {
      name,
      role: 'Admin',
      is_active: true
    }
  });
  if (owners.length !== 1) throw new Error('The name must identify exactly one active Admin.');
  await prisma.$transaction(async tx => {
    await tx.user.update({
      where: {
        id: owners[0].id
      },
      data: {
        password_hash: hashSecret(password),
        pin_code: hashSecret(pin),
        session_version: {
          increment: 1
        }
      }
    });
    await tx.auditLog.create({
      data: {
        action: 'LOCAL_OWNER_RECOVERY',
        description: 'Owner credentials rotated by the local operator.',
        performed_by_user_id: owners[0].id,
        performed_by_name: name
      }
    });
  });
  console.log('Owner credentials updated. Existing sessions revoked.');
}
if (require.main === module) main().catch(e => {
  console.error(e.message);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
