-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Admin', 'Manager', 'Cashier', 'Worker');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('Wash', 'Detailing', 'PPF');

-- CreateEnum
CREATE TYPE "JobCardStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'READY_FOR_BILLING', 'COMPLETED', 'Intake', 'In_Progress', 'Completed');

-- CreateEnum
CREATE TYPE "WorkLocation" AS ENUM ('JACK_1', 'JACK_2', 'DETAILING_CENTER', 'DETAILING_BAY_1', 'DETAILING_BAY_2');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "RegisterStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('Cash', 'Card', 'Bank');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('ACTIVE', 'APPLIED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PartnerTxType" AS ENUM ('CAPITAL_INVESTMENT', 'LOAN', 'DRAWING', 'DIVIDEND_PAYOUT');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('Roll', 'ML', 'Unit', 'PIECE');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('Cash_Drawer', 'Main_Bank');

-- CreateEnum
CREATE TYPE "VehicleMediaType" AS ENUM ('BEFORE', 'AFTER', 'DAMAGE_PROOF');

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'Worker',
    "pin_code" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "flat_commission" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "base_salary" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "registration_number" VARCHAR(30) NOT NULL,
    "normalized_plate" VARCHAR(30),
    "make" VARCHAR(50),
    "model" VARCHAR(50),
    "visits" INTEGER NOT NULL DEFAULT 0,
    "customer_name" VARCHAR(100) DEFAULT 'Walk-in Customer',
    "customer_phone" VARCHAR(25),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" "ServiceCategory" NOT NULL DEFAULT 'Wash',
    "price" DECIMAL(10,2) NOT NULL,
    "estimated_time" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "linked_inventory_id" TEXT,
    "inventory_deduction_amount" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_cards" (
    "id" TEXT NOT NULL,
    "ticket_number" VARCHAR(30),
    "vehicle_id" TEXT NOT NULL,
    "customer_name" VARCHAR(100),
    "worker_id" TEXT,
    "status" "JobCardStatus" NOT NULL DEFAULT 'QUEUED',
    "assigned_location" "WorkLocation",
    "assigned_team" VARCHAR(50),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "intake_notes" TEXT,
    "photos_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_card_workers" (
    "id" TEXT NOT NULL,
    "job_card_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_card_workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_media" (
    "id" TEXT NOT NULL,
    "job_card_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "type" "VehicleMediaType" NOT NULL DEFAULT 'BEFORE',
    "notes" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_card_services" (
    "id" TEXT NOT NULL,
    "job_card_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "price_charged" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "job_card_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" VARCHAR(30),
    "job_card_id" TEXT NOT NULL,
    "cashier_id" TEXT,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "cash_tendered" DECIMAL(10,2),
    "change_returned" DECIMAL(10,2),
    "balance_due" DECIMAL(10,2) DEFAULT 0.00,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'Cash',
    "status" VARCHAR(20) NOT NULL DEFAULT 'PAID',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "account_title" VARCHAR(100) NOT NULL,
    "account_number" VARCHAR(50) NOT NULL,
    "current_balance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'Cash',
    "bank_account_id" TEXT,
    "tender_amount" DECIMAL(10,2),
    "change_amount" DECIMAL(10,2),
    "recorded_by_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_deposits" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "customer_name" VARCHAR(100) NOT NULL,
    "customer_phone" VARCHAR(30),
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'Cash',
    "status" "DepositStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "applied_to_invoice_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" TIMESTAMP(3),

    CONSTRAINT "customer_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transfers" (
    "id" TEXT NOT NULL,
    "transfer_type" VARCHAR(30) NOT NULL DEFAULT 'CASH_TO_BANK',
    "from_account" "AccountType" NOT NULL DEFAULT 'Cash_Drawer',
    "to_account" "AccountType" NOT NULL DEFAULT 'Main_Bank',
    "from_bank_account_id" TEXT,
    "to_bank_account_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "transferred_by_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_issuances" (
    "id" TEXT NOT NULL,
    "job_card_id" TEXT NOT NULL,
    "inventory_id" TEXT NOT NULL,
    "quantity_issued" DECIMAL(10,2) NOT NULL,
    "issued_by_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_issuances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "authorized_by_pin" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_outbox" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TELEGRAM',
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "alert_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" TEXT NOT NULL,
    "item_name" VARCHAR(100) NOT NULL,
    "unit_type" "UnitType" NOT NULL DEFAULT 'Unit',
    "current_stock" DECIMAL(10,2) NOT NULL,
    "cost_per_unit" DECIMAL(10,2) NOT NULL,
    "low_stock_threshold" DECIMAL(10,2) NOT NULL DEFAULT 10.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'Cash',
    "description" TEXT,
    "recorded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger" (
    "id" TEXT NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "current_balance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "register_sessions" (
    "id" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "opened_by_user_id" TEXT,
    "starting_cash" DECIMAL(12,2) NOT NULL,
    "expected_closing_cash" DECIMAL(12,2),
    "actual_counted_cash" DECIMAL(12,2),
    "variance" DECIMAL(12,2),
    "status" "RegisterStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "register_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_inventory" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "inventory_id" TEXT NOT NULL,
    "deduction_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_equity" (
    "id" TEXT NOT NULL,
    "partner_name" VARCHAR(100) NOT NULL,
    "equity_percentage" DECIMAL(5,2) NOT NULL,
    "phone" VARCHAR(30),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_equity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_transactions" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "type" "PartnerTxType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'Cash',
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "performed_by_user_id" VARCHAR(100),
    "performed_by_name" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_branding" (
    "id" TEXT NOT NULL,
    "business_name" VARCHAR(150) NOT NULL DEFAULT 'DF PRO Car Wash & Detailing Center',
    "tagline" VARCHAR(150),
    "address" TEXT,
    "phone" VARCHAR(50),
    "email" VARCHAR(100),
    "ntn_number" VARCHAR(50),
    "logo_url" TEXT,
    "logo_size" INTEGER NOT NULL DEFAULT 120,
    "loyalty_threshold" INTEGER NOT NULL DEFAULT 5,
    "invoice_template" VARCHAR(50) NOT NULL DEFAULT 'CLASSIC_THERMAL',
    "token_template" VARCHAR(50) NOT NULL DEFAULT 'STANDARD_BOX',
    "vehicle_makes" TEXT,
    "show_business_name" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_branding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_registration_number_key" ON "vehicles"("registration_number");

-- CreateIndex
CREATE INDEX "vehicles_normalized_plate_idx" ON "vehicles"("normalized_plate");

-- CreateIndex
CREATE UNIQUE INDEX "job_cards_ticket_number_key" ON "job_cards"("ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "job_card_workers_job_card_id_user_id_key" ON "job_card_workers"("job_card_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_card_services_job_card_id_service_id_key" ON "job_card_services"("job_card_id", "service_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_job_card_id_key" ON "invoices"("job_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_account_type_key" ON "ledger"("account_type");

-- CreateIndex
CREATE UNIQUE INDEX "service_inventory_service_id_inventory_id_key" ON "service_inventory"("service_id", "inventory_id");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_linked_inventory_id_fkey" FOREIGN KEY ("linked_inventory_id") REFERENCES "inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_card_workers" ADD CONSTRAINT "job_card_workers_job_card_id_fkey" FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_card_workers" ADD CONSTRAINT "job_card_workers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_media" ADD CONSTRAINT "vehicle_media_job_card_id_fkey" FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_card_services" ADD CONSTRAINT "job_card_services_job_card_id_fkey" FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_card_services" ADD CONSTRAINT "job_card_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_card_id_fkey" FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_deposits" ADD CONSTRAINT "customer_deposits_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_deposits" ADD CONSTRAINT "customer_deposits_applied_to_invoice_id_fkey" FOREIGN KEY ("applied_to_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transfers" ADD CONSTRAINT "ledger_transfers_from_bank_account_id_fkey" FOREIGN KEY ("from_bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transfers" ADD CONSTRAINT "ledger_transfers_to_bank_account_id_fkey" FOREIGN KEY ("to_bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_issuances" ADD CONSTRAINT "material_issuances_job_card_id_fkey" FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_issuances" ADD CONSTRAINT "material_issuances_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_sessions" ADD CONSTRAINT "register_sessions_opened_by_user_id_fkey" FOREIGN KEY ("opened_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_inventory" ADD CONSTRAINT "service_inventory_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_inventory" ADD CONSTRAINT "service_inventory_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_transactions" ADD CONSTRAINT "partner_transactions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_equity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

