# Antigravity Sub-Agent Directives & Operational Rules

> **Applicability:** Mandatory for all AI agents, sub-agents, and developers working on the Car Wash & Detailing Management System.

---

## 1. Zero Paid Cloud APIs & Zero Recurring SaaS (CRITICAL)

* **Rule 1.1:** Never introduce paid cloud services (e.g., Twilio, AWS SNS, SendGrid, Firebase Paid, Google Cloud Vision, AWS Rekognition, OpenAI API).
* **Rule 1.2:** All optical character recognition (OCR) must run **offline** on the local host machine using native Tesseract OCR or local models.
* **Rule 1.3:** SMS messaging must use the **Local Android SMS Gateway** running on the shop Wi-Fi network (`http://192.168.1.50:8080`) sending via an on-premise SIM card.
* **Rule 1.4:** Cloud push notifications must exclusively use the free tier **Telegram Bot API** over standard HTTPS requests.
* **Rule 1.5:** Database storage must remain **100% on-premises** in the local PostgreSQL instance. Never connect to cloud-hosted databases.

---

## 2. Process & Architectural Decoupling (Fault Isolation)

* **Rule 2.1:** Hardware logic (Hikvision ISAPI streams, RTSP sub-stream captures, FFmpeg processes, and Tesseract OCR) **must run in an isolated service/process** from the core POS Express API.
* **Rule 2.2:** A failure, network drop, or crash in the Hikvision camera or NVR **must never crash or block the cashier's billing POS or invoice printing**.
* **Rule 2.3:** Communication between the Hardware Bridge and the Core API must be asynchronous (HTTP internal endpoints or local lightweight queue) with timeout protection (maximum 3000ms).
* **Rule 2.4:** Sub-stream RTSP channels (e.g., `Channels/102`) must be used for frame grabs to conserve CPU and RAM on the host machine. Never pull primary 4K/4MP main streams into memory.

---

## 3. Financial Ledger Immutability & Pessimistic Concurrency

* **Rule 3.1:** The `ledger` table is strictly **append-only**.
* **Rule 3.2:** **NEVER issue an `UPDATE` or `DELETE` statement on the `ledger` table.** Corrections must be made as offsetting reversing entries (`DRAWER_ADJUSTMENT` or `REVERSAL`).
* **Rule 3.3:** Every ledger entry must calculate and record the new `running_balance`.
* **Rule 3.4:** All ledger writes must execute within an explicit database transaction using **row-level locking** on the latest ledger entry:
  ```sql
  BEGIN;
  SELECT running_balance FROM ledger ORDER BY id DESC LIMIT 1 FOR UPDATE;
  -- Calculate new running balance: previous + credit - debit
  INSERT INTO ledger (...);
  COMMIT;
  ```
* **Rule 3.5:** Every ledger record must maintain an integrity checksum (SHA-256 hash linking the previous record's checksum, the transaction ID, and the running balance).

---

## 4. Strict "No-Ticket, No-Work" Flow Enforcement

* **Rule 4.1:** Wash technicians, detailers, and bay displays must not allow work to commence without an active, validated Job Card (`CW-YYYYMMDD-XXXX`).
* **Rule 4.2:** Invoices can only be created by referencing an existing, valid Job Card. Direct ad-hoc invoicing without a Job Card is prohibited in the code.
* **Rule 4.3:** Cancelling a Job Card requires an explicit reason and manager authorization recorded in `audit_logs`.
* **Rule 4.4:** If a vehicle is detected entering a bay by the Hardware Bridge and no Job Card is generated within the 3-minute grace window, the system must raise an automated `FRAUD_ALERT_INGRESS` event.

---

## 5. Local Network & Hardware Fault Tolerance

* **Rule 5.1:** All hardware endpoints reside on the `192.168.1.0/24` subnet. Configuration values (IPs, ports, credentials) must be driven by `.env` variables and never hardcoded in source files.
* **Rule 5.2:** HTTP requests to the Android SMS Gateway must have a timeout of 5 seconds and implement an exponential backoff retry queue (max 3 retries).
* **Rule 5.3:** The Hikvision ISAPI listener must automatically reconnect upon socket disconnects using a self-healing loop.
* **Rule 5.4:** Receipts must support ESC/POS network and USB printers. If the physical printer is offline or out of paper, the API transaction must still succeed, record the invoice, and flag `is_printed = FALSE` for subsequent reprint.

---

## 6. Code Hygiene & Security Directives

* **Rule 6.1:** All SQL queries must use **parameterized placeholders** (`$1`, `$2`, etc.). Concatenating raw user strings into SQL queries is strictly prohibited.
* **Rule 6.2:** All passwords stored in `users` must be hashed using `bcrypt` (minimum work factor: 10).
* **Rule 6.3:** Cashier and technician sessions must use signed JWTs with explicit expiration and role-based access control (RBAC).
* **Rule 6.4:** Before marking any implementation phase as complete, agents must run the corresponding automated tests and verify zero regressions.
