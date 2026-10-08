-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'Investor';

-- AlterEnum
ALTER TYPE "OutboxStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "session_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "job_cards" ADD COLUMN     "commission_snapshot" JSONB,
ADD COLUMN     "request_key" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "line_snapshot" JSONB;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "request_key" TEXT,
ADD COLUMN     "reversed_payment_id" TEXT;

-- AlterTable
ALTER TABLE "customer_deposits" ADD COLUMN     "bank_account_id" TEXT,
ADD COLUMN     "remaining_amount" DECIMAL(10,2),
ADD COLUMN     "request_key" TEXT;

-- AlterTable
ALTER TABLE "ledger_transfers" ADD COLUMN     "request_key" TEXT;

-- AlterTable
ALTER TABLE "material_issuances" ADD COLUMN     "request_key" TEXT,
ADD COLUMN     "unit_cost" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "bank_account_id" TEXT,
ADD COLUMN     "payment_method" "PaymentMethod" NOT NULL DEFAULT 'Cash',
ADD COLUMN     "request_key" TEXT;

-- AlterTable
ALTER TABLE "alert_outbox" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "event_key" TEXT,
ADD COLUMN     "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "bank_account_id" TEXT,
ADD COLUMN     "request_key" TEXT;

-- AlterTable
ALTER TABLE "register_sessions" ADD COLUMN     "ledger_cash_at_open" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "partner_transactions" ADD COLUMN     "bank_account_id" TEXT,
ADD COLUMN     "request_key" TEXT;

-- CreateTable
CREATE TABLE "deposit_applications" (
    "id" TEXT NOT NULL,
    "deposit_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_movements" (
    "id" TEXT NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "bank_account_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "kind" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camera_arrivals" (
    "id" TEXT NOT NULL,
    "plate" TEXT,
    "confidence" DOUBLE PRECISION,
    "snapshot_path" TEXT,
    "matched_job_id" TEXT,
    "arrived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alerted_at" TIMESTAMP(3),

    CONSTRAINT "camera_arrivals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deposit_applications_deposit_id_invoice_id_key" ON "deposit_applications"("deposit_id", "invoice_id");

-- CreateIndex
CREATE INDEX "financial_movements_created_at_account_type_idx" ON "financial_movements"("created_at", "account_type");

-- CreateIndex
CREATE INDEX "camera_arrivals_arrived_at_alerted_at_idx" ON "camera_arrivals"("arrived_at", "alerted_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_cards_request_key_key" ON "job_cards"("request_key");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reversed_payment_id_key" ON "payments"("reversed_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_request_key_key" ON "payments"("request_key");

-- CreateIndex
CREATE UNIQUE INDEX "customer_deposits_request_key_key" ON "customer_deposits"("request_key");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transfers_request_key_key" ON "ledger_transfers"("request_key");

-- CreateIndex
CREATE UNIQUE INDEX "material_issuances_request_key_key" ON "material_issuances"("request_key");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_request_key_key" ON "refunds"("request_key");

-- CreateIndex
CREATE UNIQUE INDEX "alert_outbox_event_key_key" ON "alert_outbox"("event_key");

-- CreateIndex
CREATE INDEX "alert_outbox_status_next_attempt_at_idx" ON "alert_outbox"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_request_key_key" ON "expenses"("request_key");

-- CreateIndex
CREATE UNIQUE INDEX "partner_transactions_request_key_key" ON "partner_transactions"("request_key");


-- Legacy totals stay intact. Stop storing approval secrets in refund records.
UPDATE "refunds" SET "authorized_by_pin"='APPROVED';
-- Preserve old completion dates rather than allowing later edits to move payroll periods.
UPDATE "job_cards" SET "completed_at"="updated_at" WHERE "completed_at" IS NULL AND "status" IN ('COMPLETED','Completed');
-- Active physical bays must never admit two simultaneous jobs, including legacy aliases.
CREATE UNIQUE INDEX "one_active_vehicle_per_bay" ON "job_cards" ((CASE WHEN "assigned_location"='JACK_1' THEN 'JACK_1' WHEN "assigned_location"='JACK_2' THEN 'JACK_2' WHEN "assigned_location" IN ('DETAILING_CENTER','DETAILING_BAY_1') THEN 'DETAILING_BAY_1' WHEN "assigned_location"='DETAILING_BAY_2' THEN 'DETAILING_BAY_2' ELSE NULL END)) WHERE "assigned_location" IS NOT NULL AND "status" IN ('IN_PROGRESS','In_Progress');
-- Advances preserve their original collected amount and an explicit remaining liability.
UPDATE "customer_deposits" SET "remaining_amount"=CASE WHEN "status"='ACTIVE' THEN "amount" ELSE 0 END;

CREATE TABLE "document_counters" ("key" TEXT NOT NULL, "value" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "document_counters_pkey" PRIMARY KEY ("key"));

ALTER TABLE "deposit_applications" ADD CONSTRAINT "deposit_applications_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "customer_deposits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deposit_applications" ADD CONSTRAINT "deposit_applications_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_movements" ADD CONSTRAINT "financial_movements_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
