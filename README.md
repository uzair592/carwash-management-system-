# Car Wash & Detailing Management System (Local-First)

> **Zero Monthly Cost • Immutable Financial Ledger • Hikvision Hardware Bridge • Local Telegram & SMS Transparency**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-blue.svg)](https://www.postgresql.org/)
[![Hikvision](https://img.shields.io/badge/Hikvision-ISAPI%20%2F%20RTSP-red.svg)](#hardware-iot-integration)
[![PM2](https://img.shields.io/badge/Process%20Manager-PM2-brightgreen.svg)](https://pm2.keymetrics.io/)
[![License](https://img.shields.io/badge/License-Proprietary-darkred.svg)](#)

---

## 1. Executive Summary

This project is a mission-critical, **local-first, zero-monthly-cost** management platform engineered specifically for **car wash and high-end automotive detailing centers**. 

A prevalent challenge in service bays is **revenue leakage** caused by unrecorded vehicles, cash skimming, and lack of real-time visibility for absentee investors and sleeping partners. This system eradicates operational blind spots through:

1. **A Strict "No-Ticket, No-Work" Flow:** Technicians cannot service a vehicle without a system-generated, barcode/QR-tracked physical or digital Job Card.
2. **Optical Ingress Auditing (Hardware Bridge):** Hikvision NVR smart cameras trigger line-crossing events upon vehicle arrival. Snapshots are pulled via RTSP sub-streams and analyzed by offline Tesseract OCR. If a car enters a bay without a ticket created within 3 minutes, an automated alert is triggered.
3. **Double-Entry Financial Ledger:** Every transaction, discount, inventory depletion, and expense is immutably recorded with running ledger balances protected by PostgreSQL ACID row-level locking.
4. **Instant Absentee Partner Transparency:** Real-time push notifications are dispatched to sleeping partners over the Telegram Bot API and a local-network Android SMS Gateway whenever an invoice is paid, an expense is logged, or a discrepancy occurs.
5. **Automated End-of-Day (EOD) Settlement:** Daily cron daemon automatically audits all revenues, expenses, worker commissions, and vault balances at 23:59:00, broadcasting the closing dossier to Telegram.

---

## 2. Core Business Logic & Operational Paradigm

```
  [ Vehicle Ingress ]
          │
          ▼
   (Hikvision NVR) ── Line Crossing Alert ──> [ Hardware Bridge ]
                                                     │
                                             (FFmpeg + OCR)
                                                     │
                                            Ingress Event Log
                                                     │
                                        ┌────────────┴────────────┐
                                        │ 3-Min Grace Period Check │
                                        └────────────┬────────────┘
                                                     ▼
                                        Has Job Card Been Opened?
                                        ├── Yes ──> Pair Event with Ticket
                                        └── No  ──> 🚨 TELEGRAM / SMS ALERT:
                                                    "Unregistered Vehicle in Bay"
```

### Operational Rules
* **No-Ticket, No-Work:** The POS cashier must register the customer and vehicle license plate to generate a sequential Job Card (`CW-YYYYMMDD-XXXX`). Wash technicians only initiate work once the ticket is printed or assigned on the bay terminal.
* **Cashier Shift Balancing:** The cash drawer is strictly tied to cashier sessions. Drawer opening floats, petty cash payouts, and end-of-shift cash counts are cross-referenced with the immutable ledger.
* **Zero Monthly SaaS Costs:** No subscription cloud services (no Twilio, no AWS, no SaaS POS fees). All computing, database transactions, optical recognition, and SMS dispatches run entirely on local shop infrastructure.

---

## 3. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Backend API** | Node.js (Express) | High concurrency, lightweight footprint, rich ecosystem for local device communication. |
| **Database & ORM** | PostgreSQL 15+ & Prisma ORM | Relational data integrity, ACID interactive transactions, and pessimistic locking. |
| **Frontend POS** | React.js / Vite / Tailwind CSS | Responsive, fast touch-optimized POS interface for touchscreens, tablets, and desktop terminals. |
| **Process Manager** | PM2 (`ecosystem.config.js`) | Background process supervision, zero-window background execution, auto-restart on PC reboot. |
| **Notification Engine** | Telegram Bot API + Android SMS Gateway API | Free real-time cloud push via Telegram; zero-cost carrier SMS via local Android phone HTTP server (`http://192.168.1.X:8080`). |
| **Hardware / IoT Bridge** | Hikvision NVR (ISAPI & RTSP) + FFmpeg + Tesseract OCR | Native on-premise IP camera event streaming, automated RTSP sub-stream frame grabbing, and offline license plate recognition. |

---

## 4. Target Environment & LAN Architecture

The system is deployed on a dedicated on-premise Host PC (Windows 10/11 or Ubuntu Server) operating on a private Local Area Network (LAN):

* **Shop Subnet:** `192.168.1.0/24`
* **Host Server / POS Main:** `192.168.1.100` (Node.js API: `:5000`, POS Frontend: `:3000`)
* **Hikvision NVR:** `192.168.1.64` (ISAPI HTTP: `:80`, RTSP: `:554`)
* **Android SMS Gateway Device:** `192.168.1.50:8080` (Dedicated Android smartphone connected to Wi-Fi with unlimited SMS plan)
* **Thermal Receipt Printer:** `192.168.1.200:9100` (Raw ESC/POS TCP/IP) or Local USB

---

## 5. Production Deployment (1-Click Launch)

This system is engineered for local shop owners. It runs silently in the background without open command prompts, survives PC reboots, and comes pre-loaded with Day-1 production data.

### 5.1 Environment Configuration (`.env`)
Copy `.env.example` to `.env` and configure your local shop credentials:
```env
# Server
PORT=5000
NODE_ENV=production

# PostgreSQL Database (Local)
DATABASE_URL="postgresql://carwash_admin:local_secure_pass@127.0.0.1:5432/carwash_db?schema=public"

# Transparency Engine (Telegram Partner Alerts)
TELEGRAM_BOT_TOKEN="your_bot_token_from_botfather"
TELEGRAM_CHAT_ID="-1001234567890"

# Local Android SMS Gateway (LAN Phone)
ANDROID_SMS_GATEWAY_URL="http://192.168.1.50:8080/v1/sms/send"

# Hikvision Hardware Bridge (LAN Camera)
HIKVISION_NVR_IP="192.168.1.64"
HIKVISION_NVR_USER="admin"
HIKVISION_NVR_PASSWORD="SecureCameraPass123"
```

### 5.2 1-Click Launch Scripts
On Windows, simply double-click:
```bat
start-shop.bat
```
On Linux / macOS:
```bash
chmod +x start-shop.sh
./start-shop.sh
```

**What the 1-Click Script Does:**
1. Installs all required root and UI dependencies.
2. Applies the PostgreSQL database schema (`npx prisma db push`).
3. Seeds Day-1 production users, ledger accounts, and services (`npx prisma db seed`).
4. Builds the production frontend bundle into `client/dist`.
5. Launches the **PM2 Process Supervisor** managing `carwash-api` (:5000) and `carwash-ui` (:3000) in the background.

### 5.3 Accessing the Application
* **Touch POS Terminal:** [http://localhost:3000](http://localhost:3000)
* **Investor & Partner Portal:** [http://localhost:3000](http://localhost:3000) (Tab 5: "Investor Portal")
* **Backend API & Health:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

### 5.4 Day-1 Seeded Credentials & Services
* **Shop Admin:** PIN `1234`
* **Main Cashier:** PIN `5678`
* **Pre-Loaded Standard Services:**
  * Standard Wash — Rs. 1,000
  * Full Detailing — Rs. 15,000
  * Ceramic Coating — Rs. 25,000
  * Front PPF — Rs. 40,000
* **Pre-Loaded Ledger Accounts:**
  * `Cash_Drawer`: Rs. 0.00
  * `Main_Bank`: Rs. 0.00

### 5.5 Process Management with PM2
Use these commands from the project directory to manage the background services:

```bash
# Check status of running services
npm run prod:status
# or: npx pm2 status

# View real-time aggregated logs
npm run prod:logs
# or: npx pm2 logs

# Restart all background services
npm run prod:restart
# or: npx pm2 restart all

# Stop all background services
npm run prod:stop
# or: npx pm2 stop all

# Ensure PM2 restarts automatically on Windows boot
npx pm2-startup install
npx pm2 save
```

---

## 6. Diagnostic Test Commands

```bash
# Run End-to-End Autonomous Simulation Suite
npm run simulate

# Run Hikvision Hardware Bridge & Offline OCR Test
npm run test:camera

# Run Telegram & Local Android SMS Alert Test
npm run test:alerts
```

---

## 7. Project Documentation Index

* **[ARCHITECTURE.md](file:///c:/Users/HP/Desktop/service%20management%20system/ARCHITECTURE.md)**: Full relational schema DDL, notification pipeline, and Hikvision ISAPI bridge architecture.
* **[ROADMAP.md](file:///c:/Users/HP/Desktop/service%20management%20system/ROADMAP.md)**: 5-Phase agentic execution plan from database foundation to investor dashboards.
* **[AGENT_DIRECTIVES.md](file:///c:/Users/HP/Desktop/service%20management%20system/AGENT_DIRECTIVES.md)**: Operational constraints, financial concurrency rules, and hardware decoupling standards for all Antigravity sub-agents.
