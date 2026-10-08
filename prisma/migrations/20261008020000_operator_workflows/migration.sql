-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'Accountant';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "permissions" JSONB;

-- AlterTable
ALTER TABLE "job_cards" ADD COLUMN     "services_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "business_branding" ADD COLUMN     "ticket_show_prices" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "printer_settings" (
    "id" TEXT NOT NULL DEFAULT 'shop',
    "mode" TEXT NOT NULL DEFAULT 'BROWSER',
    "host" TEXT,
    "printer_name" TEXT,
    "port" INTEGER NOT NULL DEFAULT 9100,
    "auto_cut" BOOLEAN NOT NULL DEFAULT false,
    "cut_feed" INTEGER NOT NULL DEFAULT 3,
    "paper_width" INTEGER NOT NULL DEFAULT 80,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "printer_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "printer_jobs" (
    "id" TEXT NOT NULL,
    "request_key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENDING',
    "requested_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "printer_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "printer_jobs_request_key_key" ON "printer_jobs"("request_key");

