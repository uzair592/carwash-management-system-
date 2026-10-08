const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { hashSecret } = require('../src/utils/security');

async function main() {
  console.log('🚀 Starting Master Shop Seeder for DF PRO Car Wash Management System...');

  // 1. Initialize System Feature Flags
  const defaultSettings = [
    { key: 'ENABLE_SMS_GATEWAY', value: false },
    { key: 'ENABLE_CAMERA_ANPR', value: false },
    { key: 'ENABLE_TELEGRAM_ALERTS', value: true },
  ];

  for (const setting of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log('✔ Feature Flags initialized');

  // 2. Initialize Ledger Vault Accounts (Cash_Drawer: 0, Main_Bank: 0)
  await prisma.ledger.upsert({
    where: { account_type: 'Cash_Drawer' },
    update: {},
    create: { account_type: 'Cash_Drawer', current_balance: 50000.00 },
  });

  await prisma.ledger.upsert({
    where: { account_type: 'Main_Bank' },
    update: {},
    create: { account_type: 'Main_Bank', current_balance: 150000.00 },
  });
  console.log('✔ Ledger Accounts initialized');

  // 2b. Initialize Business Bank Accounts
  const bankAccounts = [
    {
      id: '90000000-0000-0000-0000-000000000001',
      bank_name: 'Meezan Bank',
      account_title: 'DF PRO Auto Care Main',
      account_number: 'PK64MEZN0001234567890101',
      current_balance: 100000.00,
      is_active: true,
    },
    {
      id: '90000000-0000-0000-0000-000000000002',
      bank_name: 'Bank Alfalah',
      account_title: 'DF PRO Operations & POS',
      account_number: 'PK23ALFH0009876543210202',
      current_balance: 50000.00,
      is_active: true,
    },
  ];

  for (const b of bankAccounts) {
    await prisma.bankAccount.upsert({
      where: { id: b.id },
      update: {
        bank_name: b.bank_name,
        account_title: b.account_title,
        account_number: b.account_number,
        is_active: true,
      },
      create: b,
    });
  }
  console.log('✔ Business Bank Accounts Seeded: Meezan Bank, Bank Alfalah');

  // 2c. Business Branding
  await prisma.businessBranding.upsert({
    where: { id: '00000000-0000-0000-0000-000000000099' },
    update: {
      business_name: 'DF PRO Car Wash & Detailing Center',
      tagline: 'Premium Auto Care & Ceramic Studio',
      address: 'Plot 45-C, Commercial Broadway, Phase 5, DHA, Lahore',
      phone: '+92 300 8889977',
      email: 'info@dfprodetailing.com',
      ntn_number: '7482910-3',
      loyalty_threshold: 5,
      logo_size: 130,
    },
    create: {
      id: '00000000-0000-0000-0000-000000000099',
      business_name: 'DF PRO Car Wash & Detailing Center',
      tagline: 'Premium Auto Care & Ceramic Studio',
      address: 'Plot 45-C, Commercial Broadway, Phase 5, DHA, Lahore',
      phone: '+92 300 8889977',
      email: 'info@dfprodetailing.com',
      ntn_number: '7482910-3',
      loyalty_threshold: 5,
      logo_size: 130,
    },
  });
  console.log('✔ Business Branding & Loyalty Rules Seeded (Threshold: 5 visits)');

  // 3. Seed Users & Roles with Hashed Passwords & PINs:
  const users = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Shop Owner & Admin',
      role: 'Admin',
      pin_code: hashSecret('1122'),
      password_hash: hashSecret('admin123'),
      commission_rate: 0.00,
      flat_commission: 0.00,
      base_salary: 80000.00,
    },
    {
      id: '00000000-0000-0000-0000-000000000006',
      name: 'Shop Manager',
      role: 'Manager',
      pin_code: hashSecret('3344'),
      password_hash: hashSecret('manager123'),
      commission_rate: 0.00,
      flat_commission: 0.00,
      base_salary: 60000.00,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Shift Cashier 1',
      role: 'Cashier',
      pin_code: hashSecret('5566'),
      password_hash: hashSecret('cashier123'),
      commission_rate: 0.00,
      flat_commission: 0.00,
      base_salary: 45000.00,
    },
    {
      id: '00000000-0000-0000-0000-000000000007',
      name: 'Shift Cashier 2',
      role: 'Cashier',
      pin_code: hashSecret('5566'),
      password_hash: hashSecret('cashier123'),
      commission_rate: 0.00,
      flat_commission: 0.00,
      base_salary: 45000.00,
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Wash Team 1',
      role: 'Worker',
      pin_code: hashSecret('1111'),
      password_hash: hashSecret('worker123'),
      commission_rate: 0.00,
      flat_commission: 150.00,
      base_salary: 30000.00,
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      name: 'Wash Team 2',
      role: 'Worker',
      pin_code: hashSecret('2222'),
      password_hash: hashSecret('worker123'),
      commission_rate: 0.00,
      flat_commission: 150.00,
      base_salary: 30000.00,
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Detailing Specialist',
      role: 'Worker',
      pin_code: hashSecret('3333'),
      password_hash: hashSecret('worker123'),
      commission_rate: 10.00,
      flat_commission: 0.00,
      base_salary: 40000.00,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        name: u.name,
        role: u.role,
        pin_code: u.pin_code,
        password_hash: u.password_hash,
        commission_rate: u.commission_rate,
        flat_commission: u.flat_commission,
        base_salary: u.base_salary,
        is_active: true,
      },
      create: u,
    });
  }
  console.log('✔ Staff Users Seeded with Hashed Passwords & PINs');

  // 4. Inventory Master
  const inventoryItems = [
    {
      id: '10000000-0000-0000-0000-000000000001',
      item_name: 'Ceramic Coating Bottles',
      unit_type: 'ML',
      current_stock: 500.00,
      cost_per_unit: 150.00,
      low_stock_threshold: 60.00,
    },
    {
      id: '10000000-0000-0000-0000-000000000002',
      item_name: 'Microfiber Wash Mitts',
      unit_type: 'PIECE',
      current_stock: 50.00,
      cost_per_unit: 300.00,
      low_stock_threshold: 10.00,
    },
  ];

  for (const item of inventoryItems) {
    await prisma.inventory.upsert({
      where: { id: item.id },
      update: {
        item_name: item.item_name,
        unit_type: item.unit_type,
        current_stock: item.current_stock,
        cost_per_unit: item.cost_per_unit,
        low_stock_threshold: item.low_stock_threshold,
      },
      create: item,
    });
  }
  console.log('✔ Inventory Master Seeded');

  // 5. Work Areas & Services (independent pricing for Full Body vs Outer Body)
  const servicesData = [
    {
      id: '20000000-0000-0000-0000-000000000001',
      name: 'Standard Body Wash',
      category: 'Wash',
      price: 1200.00,
      estimated_time: 25,
      linked_inventory_id: null,
      inventory_deduction_amount: null,
    },
    {
      id: '20000000-0000-0000-0000-000000000010',
      name: 'Full Body Wash',
      category: 'Wash',
      price: 1500.00,
      estimated_time: 30,
      linked_inventory_id: null,
      inventory_deduction_amount: null,
    },
    {
      id: '20000000-0000-0000-0000-000000000005',
      name: 'Outer Body Wash',
      category: 'Wash',
      price: 800.00,
      estimated_time: 20,
      linked_inventory_id: null,
      inventory_deduction_amount: null,
    },
    {
      id: '20000000-0000-0000-0000-000000000002',
      name: 'Deep Underbody + Foam Wash',
      category: 'Wash',
      price: 2000.00,
      estimated_time: 40,
      linked_inventory_id: null,
      inventory_deduction_amount: null,
    },
    {
      id: '20000000-0000-0000-0000-000000000003',
      name: 'Interior Detail & Leather Condition',
      category: 'Detailing',
      price: 8500.00,
      estimated_time: 120,
      linked_inventory_id: null,
      inventory_deduction_amount: null,
    },
    {
      id: '20000000-0000-0000-0000-000000000004',
      name: '9H Ceramic Coating',
      category: 'Detailing',
      price: 25000.00,
      estimated_time: 240,
      linked_inventory_id: '10000000-0000-0000-0000-000000000001',
      inventory_deduction_amount: 30.00,
    },
  ];

  for (const s of servicesData) {
    const srv = await prisma.service.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        category: s.category,
        price: s.price,
        estimated_time: s.estimated_time,
        linked_inventory_id: s.linked_inventory_id,
        inventory_deduction_amount: s.inventory_deduction_amount,
      },
      create: s,
    });

    if (s.linked_inventory_id && s.inventory_deduction_amount) {
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
  console.log('✔ Independent Services Catalog Seeded (Full Body: 1500, Outer Body: 800, etc.)');

  // 6. Partner Equity Table
  await prisma.partnerEquity.deleteMany({});
  const partners = [
    { partner_name: 'Managing Partner', equity_percentage: 40.00, phone: '0300-1111111' },
    { partner_name: 'Sleeping Partner A', equity_percentage: 30.00, phone: '0300-2222222' },
    { partner_name: 'Sleeping Partner B', equity_percentage: 30.00, phone: '0300-3333333' },
  ];

  for (const p of partners) {
    await prisma.partnerEquity.create({ data: p });
  }
  console.log('✔ Partner Equity Seeded');

  console.log('========================================================');
  console.log('🎉 Master Shop Seeding completed successfully!');
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
