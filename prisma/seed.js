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
      base_salary: 45000.00,
    },
  });

  // Ensure Admin and Cashier base salaries are set
  await prisma.user.update({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    data: { base_salary: 80000.00 },
  });
  await prisma.user.update({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    data: { base_salary: 45000.00 },
  });

  const workers = [
    { id: '00000000-0000-0000-0000-000000000003', name: 'Ali Hassan (Lead Detailer)', role: 'Worker', pin: '1111', commission: 10.00, salary: 35000.00 },
    { id: '00000000-0000-0000-0000-000000000004', name: 'Hamza Tariq (Bay 1 Tech)', role: 'Worker', pin: '2222', commission: 8.00, salary: 28000.00 },
    { id: '00000000-0000-0000-0000-000000000005', name: 'Bilal Ahmed (Bay 2 Tech)', role: 'Worker', pin: '3333', commission: 8.00, salary: 28000.00 },
  ];

  for (const w of workers) {
    await prisma.user.upsert({
      where: { id: w.id },
      update: {
        base_salary: w.salary,
        commission_rate: w.commission,
      },
      create: {
        id: w.id,
        name: w.name,
        role: w.role,
        pin_code: w.pin,
        commission_rate: w.commission,
        base_salary: w.salary,
      },
    });
  }

  console.log('✔ Users Provisioned: Shop Admin, Cashier, and 3 Shop Floor Technicians with Base Salaries');

  // 4. Seed Detailing Consumables & High-Value Inventory
  const inventoryItems = [
    {
      id: '10000000-0000-0000-0000-000000000001',
      item_name: 'Gyeon Q2 Syncro Ceramic Coating (50ml)',
      unit_type: 'ML',
      current_stock: 250.00, // 5 bottles (50ml each)
      cost_per_unit: 120.00, // Rs. 120 per ml
      low_stock_threshold: 60.00,
    },
    {
      id: '10000000-0000-0000-0000-000000000002',
      item_name: 'XPEL Ultimate Plus TPU PPF Roll (15m)',
      unit_type: 'Roll',
      current_stock: 3.50,
      cost_per_unit: 45000.00,
      low_stock_threshold: 1.00,
    },
    {
      id: '10000000-0000-0000-0000-000000000003',
      item_name: 'Meguiar Hyper Wash High Foam Shampoo',
      unit_type: 'ML',
      current_stock: 5000.00,
      cost_per_unit: 2.50,
      low_stock_threshold: 800.00,
    },
    {
      id: '10000000-0000-0000-0000-000000000004',
      item_name: 'Koch Chemie Heavy Cut H9 Compound',
      unit_type: 'ML',
      current_stock: 1000.00,
      cost_per_unit: 8.00,
      low_stock_threshold: 200.00,
    },
  ];

  for (const item of inventoryItems) {
    await prisma.inventory.upsert({
      where: { id: item.id },
      update: {
        item_name: item.item_name,
        unit_type: item.unit_type,
        cost_per_unit: item.cost_per_unit,
        low_stock_threshold: item.low_stock_threshold,
      },
      create: item,
    });
  }
  console.log('✔ Consumable Inventory Seeded: Ceramic Coatings, PPF Rolls, Foam Shampoos');

  // 5. Seed Standard Services & Link Yield Consumables
  const standardServices = [
    {
      name: 'Standard Wash',
      category: 'Wash',
      price: 1000.00,
      estimated_time: 25,
      linked_inventory_id: '10000000-0000-0000-0000-000000000003',
      inventory_deduction_amount: 100.00, // 100 ML shampoo per wash
    },
    {
      name: 'Full Detailing',
      category: 'Detailing',
      price: 15000.00,
      estimated_time: 180,
      linked_inventory_id: '10000000-0000-0000-0000-000000000004',
      inventory_deduction_amount: 150.00, // 150 ML compound per detailing
    },
    {
      name: 'Ceramic Coating',
      category: 'Detailing',
      price: 25000.00,
      estimated_time: 300,
      linked_inventory_id: '10000000-0000-0000-0000-000000000001',
      inventory_deduction_amount: 50.00, // 50 ML bottle per car
    },
    {
      name: 'Front PPF',
      category: 'PPF',
      price: 40000.00,
      estimated_time: 360,
      linked_inventory_id: '10000000-0000-0000-0000-000000000002',
      inventory_deduction_amount: 0.25, // 0.25 roll per front bumper/hood
    },
  ];

  for (const s of standardServices) {
    const existing = await prisma.service.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.service.create({ data: s });
    } else {
      await prisma.service.update({
        where: { id: existing.id },
        data: {
          linked_inventory_id: s.linked_inventory_id,
          inventory_deduction_amount: s.inventory_deduction_amount,
        },
      });
    }
  }

  console.log(`✔ Standard Services Seeded & Linked to Consumables: ${standardServices.map((s) => s.name).join(', ')}`);

  // 5. Seed Partner Equity Split (3 Partners: 40%, 30%, 30%)
  const partners = [
    { partner_name: 'Malik Umair (Managing Partner)', equity_percentage: 40.00, phone: '0300-1111111' },
    { partner_name: 'Bilal Khan (Sleeping Partner)', equity_percentage: 30.00, phone: '0300-2222222' },
    { partner_name: 'Tariq Mehmood (Sleeping Partner)', equity_percentage: 30.00, phone: '0300-3333333' },
  ];

  for (const p of partners) {
    const existingP = await prisma.partnerEquity.findFirst({ where: { partner_name: p.partner_name } });
    if (!existingP) {
      await prisma.partnerEquity.create({ data: p });
    }
  }
  console.log('✔ Partner Equity Split Seeded (40% / 30% / 30%)');

  // 6. Seed ServiceInventory relational mappings
  for (const s of standardServices) {
    if (s.linked_inventory_id && s.inventory_deduction_amount) {
      const srv = await prisma.service.findFirst({ where: { name: s.name } });
      if (srv) {
        await prisma.serviceInventory.upsert({
          where: {
            service_id_inventory_id: {
              service_id: srv.id,
              inventory_id: s.linked_inventory_id,
            },
          },
          update: {
            deduction_amount: s.inventory_deduction_amount,
          },
          create: {
            service_id: srv.id,
            inventory_id: s.linked_inventory_id,
            deduction_amount: s.inventory_deduction_amount,
          },
        });
      }
    }
  }
  console.log('✔ ServiceInventory relational mappings initialized');
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
