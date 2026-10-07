const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting Production Database Seeder for Car Wash System...');

  // 1. Initialize System Feature Flags
  const defaultSettings = [
    { key: 'ENABLE_SMS_GATEWAY', value: false },
    { key: 'ENABLE_CAMERA_ANPR', value: false },
    { key: 'ENABLE_TELEGRAM_ALERTS', value: true },
  ];

  for (const setting of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        key: setting.key,
        value: setting.value,
      },
    });
  }
  console.log('✔ Feature Flags initialized:', defaultSettings.map((s) => s.key).join(', '));

  // 2. Initialize Ledger Vault Accounts (Cash_Drawer: 0, Main_Bank: 0)
  const cashDrawer = await prisma.ledger.upsert({
    where: { account_type: 'Cash_Drawer' },
    update: {},
    create: {
      account_type: 'Cash_Drawer',
      current_balance: 0.00,
    },
  });

  const mainBank = await prisma.ledger.upsert({
    where: { account_type: 'Main_Bank' },
    update: {},
    create: {
      account_type: 'Main_Bank',
      current_balance: 0.00,
    },
  });

  console.log('✔ Ledger Accounts initialized:', {
    Cash_Drawer: parseFloat(cashDrawer.current_balance),
    Main_Bank: parseFloat(mainBank.current_balance),
  });

  // 3. Seed Users: Initial Shop Admin (PIN: 1234) + Staff
  const adminUser = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {
      name: 'Shop Admin',
      role: 'Admin',
      pin_code: '1234',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Shop Admin',
      role: 'Admin',
      pin_code: '1234',
      commission_rate: 0.00,
    },
  });

  const cashierUser = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Main Cashier',
      role: 'Cashier',
      pin_code: '5678',
      commission_rate: 0.00,
    },
  });

  const workers = [
    { id: '00000000-0000-0000-0000-000000000003', name: 'Ali Hassan (Lead Detailer)', role: 'Worker', pin: '1111', commission: 10.00 },
    { id: '00000000-0000-0000-0000-000000000004', name: 'Hamza Tariq (Bay 1 Tech)', role: 'Worker', pin: '2222', commission: 8.00 },
    { id: '00000000-0000-0000-0000-000000000005', name: 'Bilal Ahmed (Bay 2 Tech)', role: 'Worker', pin: '3333', commission: 8.00 },
  ];

  for (const w of workers) {
    await prisma.user.upsert({
      where: { id: w.id },
      update: {},
      create: {
        id: w.id,
        name: w.name,
        role: w.role,
        pin_code: w.pin,
        commission_rate: w.commission,
      },
    });
  }

  console.log('✔ Users Provisioned: Shop Admin, Cashier, and 3 Shop Floor Technicians');

  // 4. Seed Standard Services
  const standardServices = [
    { name: 'Standard Wash', category: 'Wash', price: 1000.00, estimated_time: 25 },
    { name: 'Full Detailing', category: 'Detailing', price: 15000.00, estimated_time: 180 },
    { name: 'Ceramic Coating', category: 'Detailing', price: 25000.00, estimated_time: 300 },
    { name: 'Front PPF', category: 'PPF', price: 40000.00, estimated_time: 360 },
  ];

  for (const s of standardServices) {
    const existing = await prisma.service.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.service.create({ data: s });
    }
  }

  console.log(`✔ Standard Services Seeded: ${standardServices.map((s) => s.name).join(', ')}`);
  console.log('========================================================');
  console.log(' Production database seed completed successfully!');
  console.log(' Ready for Day 1 operations.');
  console.log('========================================================');
}

main()
  .catch((e) => {
    console.error('Fatal error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
