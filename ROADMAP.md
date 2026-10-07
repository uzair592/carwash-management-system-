# System Execution Roadmap

> **5-Phase Agentic Execution Blueprint for Car Wash & Detailing Management System**

---

## Phase Overview

| Phase | Title | Primary Focus | Key Deliverables |
|---|---|---|---|
| **Phase 1** | **Database Foundation & Core Ledger** | Data models, relational integrity, ACID transactions | DDL migrations, Seed data, Atomic Ledger Service with row locks, Concurrency test suite |
| **Phase 2** | **The Transparency Engine** | Partner visibility, alerting, zero-cost messaging | Telegram Bot integration, LAN Android SMS Gateway client, Running balance calculator |
| **Phase 3** | **The POS Interface & Job Cards** | Cashier workflow, "No-Ticket, No-Work" enforcement | React/Tailwind touch POS, ESC/POS ticket printing, Service matrix, Shift management |
| **Phase 4** | **Hardware Bridge (NVR & OCR)** | Optical gatekeeper & fraud prevention | Hikvision ISAPI listener, FFmpeg RTSP grabber, Offline Tesseract OCR, Ingress matcher |
| **Phase 5** | **Investor Dashboard & EOD Cron** | Partner metrics, financial reconciliation | Read-only Partner Portal, 23:59 EOD settlement cron, automated DB backup script |

---

## Phase 1: Database Foundation & Core Ledger

### Objectives
Establish the relational database structure in PostgreSQL, build the double-entry immutable ledger engine, and verify pessimistic locking to ensure 100% mathematical integrity under race conditions.

### Deliverables
1. **Migration Scripts (`src/database/migrations/`):**
   * Tables: `users`, `vehicles`, `services`, `job_cards`, `job_card_services`, `invoices`, `inventory`, `service_inventory_consumption`, `expenses`, `ledger`, `camera_ingress_events`.
   * Enums, check constraints, foreign keys, and indexes.
2. **Database Connection Pool (`src/database/connection.js`):**
   * Configured `pg` connection pool with automatic reconnects and environment variable loading.
3. **Ledger Transaction Service (`src/services/ledgerService.js`):**
   * Atomic `recordTransaction({ entryType, referenceId, debit, credit, description, userId })` function.
   * Explicit `BEGIN; SELECT ... FOR UPDATE; INSERT ...; COMMIT;` transaction model.
   * SHA-256 cryptographic checksum chain calculation for anti-tampering.
4. **Seed Script (`src/database/seed.js`):**
   * Default admin, cashier, and partner accounts.
   * Core service catalog (Standard Wash, Foam Polish Wash, Interior Deep Clean, 3-Stage Buffing, Ceramic Pro 9H Coating).
   * Initial zero-balanced ledger state.
5. **Phase 1 Validation Suite:**
   * Automated test simulating 10 concurrent ledger writes ensuring zero balance drift or deadlocks.

### Acceptance Criteria
- [ ] Running `npm run db:migrate` initializes all tables without syntax errors.
- [ ] Running `npm run db:seed` provisions standard vehicle categories and baseline services.
- [ ] Concurrent invoice/expense ledger posting tests demonstrate 100% balance consistency with zero lost updates.

---

## Phase 2: The Transparency Engine (Notifications)

### Objectives
Build the dual-channel zero-cost notification pipeline that calculates financial metrics and dispatches updates to sleeping partners whenever a business event occurs.

### Deliverables
1. **Notification Router (`src/services/notificationService.js`):**
   * Event dispatcher listening for events: `INVOICE_PAID`, `EXPENSE_LOGGED`, `FRAUD_ALERT_INGRESS`, `EOD_SUMMARY`.
2. **Telegram Bot Adapter (`src/integrations/telegramBot.js`):**
   * Outbound message dispatcher using official Telegram Bot API via HTTPS.
   * Group broadcast support with Markdown formatting and financial icons.
   * Partner query command listeners: `/balance`, `/today`, `/active_bays`.
3. **Android SMS Gateway Adapter (`src/integrations/androidSmsGateway.js`):**
   * Local network client dispatching HTTP POST requests to the dedicated Android phone (`http://192.168.1.50:8080/send`).
   * Queueing mechanism with exponential retry logic if the phone temporarily disconnects from Wi-Fi.
4. **Investor Financial Dossier Builder (`src/utils/formatters.js`):**
   * Formats real-time invoice summaries including daily gross revenue, daily expenses, net cash in drawer, and cumulative ledger vault balance.

### Acceptance Criteria
- [ ] Paid invoice trigger results in a Telegram message delivered within 2 seconds.
- [ ] Fallback/dual SMS dispatch successfully hits the local Android HTTP gateway endpoint.
- [ ] Formatting accurately reflects the latest locked ledger balance.

---

## Phase 3: The POS Interface & Job Cards

### Objectives
Build the high-velocity touch-optimized cashier POS interface and enforce the strict operational policy: "No-Ticket, No-Work".

### Deliverables
1. **Cashier API Endpoints (`src/controllers/posController.js`):**
   * Vehicle lookup by license plate (auto-populates customer info if returning vehicle).
   * Job card creation (`POST /api/job-cards`) generating sequential `CW-YYYYMMDD-XXXX` ticket.
   * Invoice generation (`POST /api/invoices`) triggering atomic ledger credit and notification event.
2. **Ticket Printing Integration (`src/services/printerService.js`):**
   * ESC/POS raw command generator outputting bay ticket with barcode/QR code and itemized service checklist.
3. **Touch POS Frontend (`client/src/`):**
   * Quick vehicle intake modal (plate entry, vehicle type selector, customer mobile).
   * Service selection grid categorized by Wash, Detailing, Coating, and Addons.
   * Active Bay Status Board displaying vehicles currently in wash bays with live elapsed timers.
   * Checkout & Payment modal supporting Cash, Card, and Mobile Wallet.

### Acceptance Criteria
- [ ] Cashier can create a vehicle intake and generate a Job Card in under 20 seconds.
- [ ] Technicians' bay board indicates "No active ticket" if a bay is occupied without a ticket.
- [ ] Completing a job card generates an invoice and prints an ESC/POS receipt.

---

## Phase 4: Hardware Bridge (Hikvision NVR & OCR)

### Objectives
Integrate physical security cameras as automated digital watchdogs to verify that all cars entering the premises have valid job cards opened by the cashier.

### Deliverables
1. **ISAPI Alert Stream Listener (`src/hardware/hikvisionListener.js`):**
   * Persistent HTTP multipart stream subscriber connecting to Hikvision NVR at `192.168.1.64`.
   * Real-time parser for Line Crossing (`linedetection`) and Intrusion Detection (`fielddetection`) events.
2. **Snapshot Extraction Engine (`src/hardware/frameGrabber.js`):**
   * Spawns an isolated FFmpeg process to capture a single crisp frame from the RTSP sub-stream (`rtsp://.../Streaming/Channels/102`).
   * Saves snapshot to `snapshots/ingress_YYYYMMDD_HHMMSS.jpg`.
3. **Offline OCR Engine (`src/hardware/ocrService.js`):**
   * Image pre-processing (grayscale, thresholding, contrast stretching).
   * Tesseract OCR execution extracting the vehicle license plate string without external cloud APIs.
4. **Anti-Fraud Correlation Watcher (`src/hardware/auditWatcher.js`):**
   * Correlates camera ingress event with `job_cards` database table.
   * If no job card matching the plate or bay is opened within a 3-minute grace window, flags `is_audit_flagged = TRUE` and fires a High-Priority Telegram Alert with the vehicle photo attached.

### Acceptance Criteria
- [ ] Line crossing event reliably triggers snapshot capture in < 1.5 seconds.
- [ ] Offline OCR extracts test license plates with acceptable fidelity without internet access.
- [ ] An unrecorded vehicle in a wash bay triggers an absentee partner alert within 3 minutes.

---

## Phase 5: Investor Dashboard & EOD Cron Jobs

### Objectives
Deliver an investor-grade reporting portal for absentee sleeping partners and automated End-of-Day reconciliation jobs.

### Deliverables
1. **Partner Web Portal (`client/src/pages/PartnerDashboard.jsx`):**
   * Responsive read-only view accessible from mobile phones or desktop.
   * Metrics: Daily Revenue, Weekly Trajectory, Cash vs Digital Split, Inventory Depletion alerts, Real-time Bay Camera snapshots.
2. **End-of-Day (EOD) Reconciliation Cron (`src/jobs/eodReconciliation.js`):**
   * Scheduled cron job running every night at 23:59:00 local time.
   * Calculates Total Vehicles Washed, Services Breakdown, Chemical Consumables Used, Total Cash In Drawer, and Net Partner Profit.
   * Pushes the **Daily Financial Dossier** to Telegram and SMS.
3. **Automated Database Backup Job (`scripts/backup_db.bat` / `.sh`):**
   * Daily PostgreSQL `pg_dump` rotation with local directory retention (last 30 days) and checksum validation.

### Acceptance Criteria
- [ ] At 23:59, the system automatically produces and broadcasts the comprehensive EOD report.
- [ ] Partner dashboard displays real-time financial snapshots without granting cashier write access.
- [ ] Database backup runs without service disruption and produces verifiable `.sql.gz` dump archives.
