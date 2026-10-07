const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial database records...');

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
  console.log('Provisioned System Feature Flags:', defaultSettings);

  // 2. Initialize Ledger Accounts
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

  console.log('Initialized Ledger Accounts:', {
    Cash_Drawer: cashDrawer.current_balance,
    Main_Bank: mainBank.current_balance,
  });

  // 3. Initialize Default Admin & Cashier Users
  const admin = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'System Administrator',
      role: 'Admin',
      pin_code: '1234',
      commission_rate: 0.00,
    },
  });

  const cashier = await prisma.user.upsert({
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

  const worker1 = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Ali Hassan (Lead Detailer)',
      role: 'Worker',
      pin_code: '1111',
      commission_rate: 10.00,
    },
  });

  const worker2 = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Hamza Tariq (Bay 1 Tech)',
      role: 'Worker',
      pin_code: '2222',
      commission_rate: 8.00,
    },
  });

  const worker3 = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000005' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000005',
      name: 'Bilal Ahmed (Bay 2 Tech)',
      role: 'Worker',
      pin_code: '3333',
      commission_rate: 8.00,
    },
  });

  console.log('Provisioned Users:', [admin.name, cashier.name, worker1.name, worker2.name, worker3.name]);

  // 4. Initialize Baseline Wash & Detailing Services
  const services = [
    { name: 'Express Body Foam Wash', category: 'Wash', price: 1000.00, estimated_time: 25 },
    { name: 'Premium Wash & Undercarriage', category: 'Wash', price: 1800.00, estimated_time: 40 },
    { name: 'Interior Deep Shampoo & Vacuum', category: 'Detailing', price: 4500.00, estimated_time: 90 },
    { name: '3-Stage Compound & Paint Correction', category: 'Detailing', price: 12000.00, estimated_time: 240 },
    { name: 'Front Bumper & Hood PPF Installation', category: 'PPF', price: 35000.00, estimated_time: 360 },
  ];

  for (const s of services) {
    const existing = await prisma.service.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.service.create({ data: s });
    }
  }

  console.log(`Configured ${services.length} baseline services.`);
  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
