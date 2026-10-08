const {
  PrismaClient
} = require('@prisma/client');
const {
  hashSecret
} = require('../src/utils/security');
const prisma = new PrismaClient();
async function main() {
  if (!(await prisma.user.count({
    where: {
      role: 'Admin',
      is_active: true
    }
  }))) {
    if ((process.env.SHOP_ADMIN_PASSWORD || '').length < 12 || !/^\d{4,8}$/.test(process.env.SHOP_ADMIN_PIN || '')) throw new Error('For first setup, provide SHOP_ADMIN_PASSWORD (12+ characters) and SHOP_ADMIN_PIN (4–8 digits).');
    await prisma.user.create({
      data: {
        name: process.env.SHOP_ADMIN_NAME || 'Shop Owner',
        role: 'Admin',
        password_hash: hashSecret(process.env.SHOP_ADMIN_PASSWORD),
        pin_code: hashSecret(process.env.SHOP_ADMIN_PIN)
      }
    });
  }
  for (const account_type of ['Cash_Drawer', 'Main_Bank']) await prisma.ledger.upsert({
    where: {
      account_type
    },
    create: {
      account_type,
      current_balance: 0
    },
    update: {}
  });
  for (const key of ['ENABLE_CAMERA_ANPR', 'ENABLE_SMS_GATEWAY', 'ENABLE_TELEGRAM_ALERTS']) await prisma.systemSetting.upsert({
    where: {
      key
    },
    create: {
      key,
      value: false
    },
    update: {}
  });
  console.log('Shop initialised. Existing accounts, balances, services and settings preserved.');
}
main().finally(() => prisma.$disconnect());
