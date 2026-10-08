const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Master Shop Seeder for Car Wash Management System...');

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
    create: { account_type: 'Cash_Drawer', current_balance: 0.00 },
  });

  await prisma.ledger.upsert({
    where: { account_type: 'Main_Bank' },
    update: {},
    create: { account_type: 'Main_Bank', current_balance: 0.00 },
  });
  console.log('✔ Ledger Accounts initialized');

  // 3. Seed Users & Roles:
  // - 1 Owner / Admin (PIN: 1122, Full permissions)
  // - 1 Shop Manager (PIN: 3344, Day-to-day operations & discount approvals)
  // - 2 Cashiers (PIN: 5566, Intake & Billing only)
  // - 3 Team Worker profiles: Wash Team 1 (Jack 1), Wash Team 2 (Jack 2), Detailing Specialist (Detailing Center)

  const users = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Shop Owner & Admin',
      role: 'Admin',
      pin_code: '1122',
      commission_rate: 0.00,
      flat_commission: 0.00,
      base_salary: 80000.00,
    },
    {
      id: '00000000-0000-0000-0000-000000000006',
      name: 'Shop Manager',
      role: 'Manager',
      pin_code: '3344',
      commission_rate: 0.00,
      flat_commission: 0.00,
      base_salary: 60000.00,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Shift Cashier 1',
      role: 'Cashier',
      pin_code: '5566',
      commission_rate: 0.00,
      flat_commission: 0.00,
      base_salary: 45000.00,
    },
    {
      id: '00000000-0000-0000-0000-000000000007',
      name: 'Shift Cashier 2',
      role: 'Cashier',
      pin_code: '5566',
      commission_rate: 0.00,
      flat_commission: 0.00,
      base_salary: 45000.00,
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Wash Team 1',
      role: 'Worker',
      pin_code: '1111',
      commission_rate: 0.00,
      flat_commission: 150.00, // Rs. 150 per car
      base_salary: 30000.00,
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      name: 'Wash Team 2',
      role: 'Worker',
      pin_code: '2222',
      commission_rate: 0.00,
      flat_commission: 150.00, // Rs. 150 per car
      base_salary: 30000.00,
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Detailing Specialist',
      role: 'Worker',
      pin_code: '3333',
      commission_rate: 10.00, // 10% commission on detailing
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
        commission_rate: u.commission_rate,
        flat_commission: u.flat_commission,
        base_salary: u.base_salary,
        is_active: true,
      },
      create: u,
    });
  }
  console.log('✔ Staff Users Seeded (Admin [1122], Manager [3344], Cashiers [5566], 3 Workers)');

  // 4. Inventory Master:
  // - Ceramic Coating Bottles (Unit: ML, Current: 500, Threshold: 60, Cost/Unit: Rs. 150)
  // - Microfiber Wash Mitts (Unit: PIECE, Current: 50, Threshold: 10, Cost/Unit: Rs. 300)
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
  console.log('✔ Inventory Master Seeded: Ceramic Liquid (500ml), Microfiber Mitts (50 pcs)');

  // 5. Work Areas & Services:
  // - Standard Body Wash (Jack 1 / Jack 2, Rs. 1,200)
  // - Deep Underbody + Foam Wash (Jack 1 / Jack 2, Rs. 2,000)
  // - Interior Detail & Leather Condition (Detailing Center, Rs. 8,500)
  // - 9H Ceramic Coating (Detailing Center, Rs. 25,000, linked to 30ml Ceramic Liquid)
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
      inventory_deduction_amount: 30.00, // 30 ML deducted
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
  console.log('✔ Services & Consumable Linkages Seeded (9H Ceramic linked to 30ml Ceramic Liquid)');

  // 6. Partner Equity Table:
  // - Managing Partner (40%), Sleeping Partner A (30%), Sleeping Partner B (30%)
  await prisma.partnerEquity.deleteMany({});

  const partners = [
    { partner_name: 'Managing Partner', equity_percentage: 40.00, phone: '0300-1111111' },
    { partner_name: 'Sleeping Partner A', equity_percentage: 30.00, phone: '0300-2222222' },
    { partner_name: 'Sleeping Partner B', equity_percentage: 30.00, phone: '0300-3333333' },
  ];

  for (const p of partners) {
    await prisma.partnerEquity.create({ data: p });
  }
  console.log('✔ Partner Equity Seeded: Managing Partner (40%), Sleeping Partner A (30%), Sleeping Partner B (30%)');
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
