ALTER TABLE "users" ADD COLUMN "overtime_rate" DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (overtime_rate >= 0);
CREATE TABLE "staff_overtime" (
 "id" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "work_date" DATE NOT NULL, "minutes" INTEGER NOT NULL CHECK (minutes BETWEEN 1 AND 1440),
 "hourly_rate" DECIMAL(10,2) NOT NULL CHECK (hourly_rate > 0), "amount" DECIMAL(12,2) NOT NULL CHECK (amount > 0),
 "notes" TEXT NOT NULL, "request_key" TEXT NOT NULL UNIQUE, "version" INTEGER NOT NULL DEFAULT 0,
 "voided_at" TIMESTAMP(3), "void_reason" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "staff_overtime_user_id_work_date_idx" ON "staff_overtime"("user_id", "work_date");
