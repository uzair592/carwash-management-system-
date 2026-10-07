# System Architecture Specification

> **Local-First Car Wash & Detailing Management Platform**  
> *Target Runtime: On-Premises Host PC (Node.js, PostgreSQL 15+, LAN Hardware Bus)*

---

## 1. System Architecture Overview

The system architecture is engineered around three isolated tiers:
1. **The Core Financial & Application Tier (Node.js & PostgreSQL):** Manages relational entities, enforces the "No-Ticket, No-Work" business state machine, and guarantees double-entry ledger accuracy using pessimistic row locking.
2. **The Transparency Engine (Notification Dispatcher):** Calculates live drawer balances and pushes ledger updates over Telegram Bot API and a local Android SMS Gateway HTTP bridge.
3. **The Hardware Bridge (Hikvision ISAPI + FFmpeg + OCR):** An isolated daemon listening for optical ingress alarms, snapping RTSP sub-stream frames, and performing offline license plate recognition to audit bay entry against active job cards.

```mermaid
graph TD
    subgraph LAN Infrastructure [Local Area Network 192.168.1.0/24]
        subgraph Hardware Layer
            CAM[Hikvision Entry Camera\n192.168.1.64]
            NVR[Hikvision NVR\n192.168.1.60]
            SMS[Android SMS Phone\n192.168.1.50:8080]
            PRN[Thermal Receipt Printer\n192.168.1.200:9100]
        end

        subgraph Host Machine Services [192.168.1.100]
            HB[Hardware Bridge Daemon\n- ISAPI Event Listener\n- FFmpeg Frame Grabber\n- Tesseract OCR Engine]
            API[Node.js Express Backend\n- Business Logic\n- Strict 'No-Ticket No-Work' Rules\n- Financial Transaction Engine]
            POS[React.js POS Terminal\n- Cashier Interface\n- Job Card Dispatcher]
            DB[(PostgreSQL 15+\n- ACID Ledger\n- Relational State)]
            NOTIF[Notification Engine\n- Balance Calculator\n- Telegram & SMS Router]
        end
    end

    subgraph External Cloud [Zero Cost Cloud Services]
        TG[Telegram Bot API\nPartner Broadcast Group]
    end

    CAM -->|Line Crossing Alarm| NVR
    NVR -->|HTTP Multipart Alert Stream| HB
    HB -->|RTSP Frame Capture| NVR
    HB -->|Ingress Plate Event| API

    POS -->|HTTP / WebSocket| API
    API -->|ACID SQL & Row Locks| DB
    API -->|Raw ESC/POS| PRN
    
    API -->|Trigger Alert Event| NOTIF
    NOTIF -->|LAN HTTP POST| SMS
    NOTIF -->|HTTPS Outbound| TG
```

---

## 2. Complete Database Schema (DDL & Entities)

The database enforces referential integrity, check constraints, and non-nullable audit fields. Ledger tables are **append-only**.

```mermaid
erDiagram
    USERS ||--o{ JOB_CARDS : creates
    USERS ||--o{ INVOICES : bills
    USERS ||--o{ EXPENSES : logs
    USERS ||--o{ LEDGER : records
    VEHICLES ||--o{ JOB_CARDS : assigned
    VEHICLES ||--o{ INVOICES : billed_to
    JOB_CARDS ||--|{ JOB_CARD_SERVICES : contains
    SERVICES ||--o{ JOB_CARD_SERVICES : catalogued
    JOB_CARDS ||--o{ INVOICES : generates
    INVOICES ||--|| LEDGER : writes_credit
    EXPENSES ||--|| LEDGER : writes_debit
    SERVICES ||--o{ SERVICE_INVENTORY_CONSUMPTION : requires
    INVENTORY ||--o{ SERVICE_INVENTORY_CONSUMPTION : supplies
    VEHICLES ||--o{ CAMERA_INGRESS_EVENTS : correlates
```

### 2.1 Entity DDL Definitions

#### 1. `users`
Represents system actors (Cashiers, Managers, Technicians, Absentee Partners).
```sql
CREATE TYPE user_role AS ENUM ('ADMIN', 'CASHIER', 'PARTNER', 'TECHNICIAN');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'CASHIER',
    phone VARCHAR(20) NOT NULL,
    telegram_chat_id VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role ON users(role);
```

#### 2. `vehicles`
Stores customer vehicle registry and profile metadata.
```sql
CREATE TYPE vehicle_category AS ENUM ('SEDAN', 'HATCHBACK', 'CROSSOVER', 'SUV', 'PICKUP', 'BIKE');

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    category vehicle_category NOT NULL DEFAULT 'SEDAN',
    make VARCHAR(50),
    model VARCHAR(50),
    color VARCHAR(30),
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    notes TEXT,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_visited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vehicles_plate ON vehicles(license_plate);
CREATE INDEX idx_vehicles_phone ON vehicles(customer_phone);
```

#### 3. `services`
Catalog of car wash packages, detailing tiers, and add-ons.
```sql
CREATE TYPE service_type AS ENUM ('WASH', 'DETAILING', 'POLISHING', 'CERAMIC_COATING', 'ADDON');

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    service_type service_type NOT NULL DEFAULT 'WASH',
    pricing_matrix JSONB NOT NULL, -- e.g. {"SEDAN": 1500, "SUV": 2000, "PICKUP": 2500}
    standard_duration_minutes INT NOT NULL DEFAULT 30,
    commission_percentage NUMERIC(5, 2) DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. `job_cards`
Core operational entity enforcing "No-Ticket, No-Work".
```sql
CREATE TYPE job_status AS ENUM ('QUEUED', 'IN_BAY', 'IN_PROGRESS', 'QUALITY_CHECK', 'COMPLETED', 'CANCELLED');

CREATE TABLE job_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(30) UNIQUE NOT NULL, -- format CW-YYYYMMDD-XXXX
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
    bay_number INT NOT NULL DEFAULT 1,
    status job_status NOT NULL DEFAULT 'QUEUED',
    total_quoted_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    queued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_card_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_card_id UUID NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    price_charged NUMERIC(10, 2) NOT NULL,
    technician_commission NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

CREATE INDEX idx_job_cards_status ON job_cards(status);
CREATE INDEX idx_job_cards_ticket ON job_cards(ticket_number);
```

#### 5. `invoices`
Final settlement document generated upon service completion.
```sql
CREATE TYPE payment_mode AS ENUM ('CASH', 'CREDIT_DEBIT_CARD', 'MOBILE_WALLET', 'BANK_TRANSFER');
CREATE TYPE invoice_status AS ENUM ('PAID', 'REFUNDED', 'VOID');

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(30) UNIQUE NOT NULL, -- format INV-YYYYMMDD-XXXX
    job_card_id UUID UNIQUE NOT NULL REFERENCES job_cards(id) ON DELETE RESTRICT,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    subtotal NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    net_total NUMERIC(10, 2) NOT NULL,
    payment_mode payment_mode NOT NULL DEFAULT 'CASH',
    payment_status invoice_status NOT NULL DEFAULT 'PAID',
    payment_reference VARCHAR(100),
    is_printed BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_date ON invoices(paid_at);
```

#### 6. `inventory`
Tracks wash chemicals, ceramic coatings, microfiber pads, and consumables.
```sql
CREATE TYPE unit_measure AS ENUM ('LITERS', 'MILLILITERS', 'PIECES', 'BOTTLES', 'KILOGRAMS');

CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    unit unit_measure NOT NULL DEFAULT 'PIECES',
    current_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    reorder_threshold NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    cost_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    last_restocked_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Consumption mapping per service
CREATE TABLE service_inventory_consumption (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
    quantity_used NUMERIC(10, 2) NOT NULL
);
```

#### 7. `expenses`
Operational outflows (chemicals, diesel for generators, payroll advances, lunches).
```sql
CREATE TYPE expense_category AS ENUM (
    'CHEMICALS_CONSUMABLES', 
    'UTILITIES_ELECTRICITY_WATER', 
    'EQUIPMENT_MAINTENANCE', 
    'STAFF_SALARY_ADVANCE', 
    'TEA_REFRESHMENTS', 
    'PETTY_CASH_MISC'
);

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_number VARCHAR(30) UNIQUE NOT NULL, -- EXP-YYYYMMDD-XXXX
    category expense_category NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    paid_to VARCHAR(100) NOT NULL,
    recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    receipt_image_path VARCHAR(255),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
```

#### 8. `ledger` (The Immutable Financial Core)
Double-entry append-only ledger. Calculates running balances under explicit row locks.
```sql
CREATE TYPE ledger_entry_type AS ENUM ('REVENUE_INVOICE', 'EXPENSE_OUTFLOW', 'CAPITAL_INJECTION', 'PARTNER_DRAWING', 'DRAWER_ADJUSTMENT');

CREATE TABLE ledger (
    id BIGSERIAL PRIMARY KEY,
    entry_type ledger_entry_type NOT NULL,
    reference_id UUID, -- References invoices(id) or expenses(id)
    debit NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (debit >= 0),
    credit NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (credit >= 0),
    running_balance NUMERIC(12, 2) NOT NULL,
    recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    description TEXT NOT NULL,
    entry_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64) NOT NULL -- SHA-256 (prev_checksum + entry_id + running_balance)
);

CREATE INDEX idx_ledger_timestamp ON ledger(entry_timestamp);
CREATE INDEX idx_ledger_entry_type ON ledger(entry_type);
```

#### 9. `camera_ingress_events`
Stores physical camera detections from Hikvision NVR for audit matching.
```sql
CREATE TABLE camera_ingress_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camera_id VARCHAR(50) NOT NULL,
    ingress_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    snapshot_path VARCHAR(255) NOT NULL,
    ocr_raw_text VARCHAR(50),
    ocr_confidence NUMERIC(5, 2),
    matched_job_card_id UUID REFERENCES job_cards(id) ON DELETE SET NULL,
    is_audit_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    audit_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ingress_time ON camera_ingress_events(ingress_time);
CREATE INDEX idx_ingress_flagged ON camera_ingress_events(is_audit_flagged);
```

---

## 3. The Notification Engine Workflow

To guarantee transparency for absentee sleeping partners, **every financial event instantly updates the ledger balance and broadcasts notifications**.

```mermaid
sequenceDiagram
    autonumber
    actor Cashier
    participant API as Backend API
    participant DB as PostgreSQL (ACID)
    participant NE as Notification Engine
    participant TG as Telegram Bot API
    participant SMS as Android SMS Gateway (LAN)

    Cashier->>API: Settle Invoice / Log Expense
    activate API
    API->>DB: BEGIN TRANSACTION (Pessimistic Row Lock)
    DB-->>API: Lock Latest Ledger Row (FOR UPDATE)
    API->>DB: INSERT Invoice / Expense
    API->>DB: INSERT Ledger Row (New Running Balance)
    API->>DB: COMMIT TRANSACTION
    deactivate API

    API->>NE: Dispatch Financial Event Payload
    activate NE
    NE->>NE: Format Investor Dossier (Markdown & Plaintext)
    
    par Dual Channel Dispatch
        NE->>TG: HTTPS POST /sendMessage (Markdown formatted)
        TG-->>NE: 200 OK (Message ID)
    and
        NE->>SMS: LAN HTTP POST http://192.168.1.50:8080/send
        SMS-->>NE: 200 OK (SMS Queued to SIM)
    end
    deactivate NE
```

### 3.1 Balance Calculation & Pessimistic Concurrency
To eliminate race conditions between simultaneous billing desks:
```sql
-- Executed inside an explicit transaction:
BEGIN;
SELECT running_balance 
FROM ledger 
ORDER BY id DESC 
LIMIT 1 
FOR UPDATE;

-- Calculate: new_balance = previous_balance + credit - debit
INSERT INTO ledger (entry_type, reference_id, debit, credit, running_balance, recorded_by, description, checksum)
VALUES (...);
COMMIT;
```

### 3.2 Notification Payload Format (Telegram & SMS)

#### Telegram Channel Format (HTML / MarkdownV2):
```
💰 *TRANSACTION LOGGED: CASH INFLOW*
━━━━━━━━━━━━━━━━━━━━
📄 *Invoice:* `INV-20261007-0042`
🚗 *Vehicle:* `ABC-1234` (Toyota Fortuner - SUV)
🛠 *Service:* Premium Foam Wash + Ceramic Spray Wax
💵 *Amount Paid:* Rs. 3,500 [CASH]
👤 *Cashier:* Asif Ali (POS Terminal 1)

📊 *UPDATED FINANCIAL SNAPSHOT*
• Today's Gross Revenue: Rs. 48,200 (18 Vehicles)
• Today's Expenses: Rs. 4,100
• Net Drawer Cash: Rs. 44,100
• Current Vault Balance: Rs. 142,650
⏰ 07-Oct-2026 23:15:00 PKT
```

#### Android SMS Gateway Local API Format:
* **Target:** `POST http://192.168.1.50:8080/send`
* **Headers:** `Authorization: Bearer <LOCAL_GATEWAY_TOKEN>`, `Content-Type: application/json`
* **Body:**
  ```json
  {
    "to": "+923001234567",
    "message": "[CARWASH-ALERT] INV-0042 Paid: Rs. 3,500 (ABC-1234 Fortuner). Net Cash: Rs. 44,100. Vault: Rs. 142,650."
  }
  ```

---

## 4. Hardware Bridge Logic (Hikvision NVR + OCR)

The Hardware Bridge operates as an independent background service to isolate camera connectivity glitches from the billing POS.

```mermaid
stateDiagram-v2
    [*] --> ListeningISAPI: HTTP Multipart Stream Active
    ListeningISAPI --> AlarmTriggered: Line Crossing / Intrusion Event
    AlarmTriggered --> RTSPGrab: Invoke FFmpeg on Sub-stream (Channel 102)
    RTSPGrab --> FramePreProcessing: Grayscale + Contrast Normalization
    FramePreProcessing --> OfflineOCR: Run Tesseract OCR on License Plate ROI
    OfflineOCR --> LogIngress: Store in DB camera_ingress_events
    LogIngress --> CorrelationTimer: Start 3-Minute Audit Watcher
    
    state CorrelationTimer {
        [*] --> PollingJobCards
        PollingJobCards --> Matched: Job Card Created for Plate within 3 mins
        PollingJobCards --> Timeout: No Ticket Found after 3 mins
    }

    Matched --> [*]: Link Event to Job Card (Status OK)
    Timeout --> DispatchFraudAlert: 🚨 Trigger Absentee Partner Alert (Telegram + SMS)
    DispatchFraudAlert --> [*]
```

### 4.1 Hikvision ISAPI Alert Stream Protocol
* Connects to Hikvision NVR via persistent chunked HTTP GET:  
  `http://<nvr_ip>/ISAPI/Event/notification/alertStream` using Digest Authentication.
* Parses incoming XML event packets:
  ```xml
  <EventNotificationAlert version="2.0">
      <eventType>linedetection</eventType>
      <eventDescription>Line Crossing Detection</eventDescription>
      <channelID>1</channelID>
      <dateTime>2026-10-07T23:10:00+05:00</dateTime>
  </EventNotificationAlert>
  ```

### 4.2 Snapshot Extraction via FFmpeg Sub-Stream
High-resolution main streams can cause memory bottlenecks on modest PCs. The bridge extracts 1 lossless JPEG from the RTSP **sub-stream**:
```bash
ffmpeg -rtsp_transport tcp -y -i "rtsp://admin:pass123@192.168.1.64:554/Streaming/Channels/102" -vframes 1 -q:v 2 "snapshots/ingress_20261007_231000.jpg"
```

### 4.3 Offline OCR Pipeline
1. Crop license plate Region of Interest (ROI) based on camera entry geometry.
2. OpenCV/Sharp image enhancement: Binarization (Otsu thresholding), edge sharpening.
3. Tesseract OCR execution (Offline whitelist: `0-9 A-Z -`).
4. Output plate normalized string (e.g., `ICT-LE-492` or `BGP-883`).

### 4.4 Unregistered Ingress Audit (Anti-Fraud Guard)
1. Upon logging the entry event, a job card lookup watcher is scheduled for `T + 180 seconds`.
2. If `job_cards` table contains no matching plate or no cashier has opened an intake ticket:
   * Event marked as `is_audit_flagged = TRUE`.
   * Urgent Fraud Alert dispatched to Sleeping Partners with the snapped image attachment over Telegram.
