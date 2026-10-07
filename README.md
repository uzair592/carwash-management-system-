# Car Wash & Detailing Management System (Local-First)

> **Zero Monthly Cost • Immutable Financial Ledger • Hikvision Hardware Bridge • Local Telegram & SMS Transparency**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-blue.svg)](https://www.postgresql.org/)
[![Hikvision](https://img.shields.io/badge/Hikvision-ISAPI%20%2F%20RTSP-red.svg)](#hardware-iot-integration)
[![License](https://img.shields.io/badge/License-Proprietary-darkred.svg)](#)

---

## 1. Executive Summary

This project is a mission-critical, **local-first, zero-monthly-cost** management platform engineered specifically for **car wash and high-end automotive detailing centers**. 

A prevalent challenge in service bays is **revenue leakage** caused by unrecorded vehicles, cash skimming, and lack of real-time visibility for absentee investors and sleeping partners. This system eradicates operational blind spots through:

1. **A Strict "No-Ticket, No-Work" Flow:** Technicians cannot service a vehicle without a system-generated, barcode/QR-tracked physical or digital Job Card.
2. **Optical Ingress Auditing (Hardware Bridge):** Hikvision NVR smart cameras trigger line-crossing events upon vehicle arrival. Snapshots are pulled via RTSP sub-streams and analyzed by offline Tesseract OCR. If a car enters a bay without a ticket created within 3 minutes, an automated alert is triggered.
3. **Double-Entry Financial Ledger:** Every transaction, discount, inventory depletion, and expense is immutably recorded with running ledger balances protected by PostgreSQL ACID row-level locking.
4. **Instant Absentee Partner Transparency:** Real-time push notifications are dispatched to sleeping partners over the Telegram Bot API and a local-network Android SMS Gateway whenever an invoice is paid, an expense is logged, or a discrepancy occurs.

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
| **Database** | PostgreSQL 15+ | Relational data integrity, ACID transactions, table partitioning, JSONB flexibility, and pessimistic locking (`FOR UPDATE`). |
| **Frontend POS** | React.js / Tailwind CSS | Responsive, fast touch-optimized POS interface for touchscreens, tablets, and desktop terminals. |
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

## 5. Getting Started & Local Development Setup

### 5.1 Prerequisites
1. **Node.js:** v18.x LTS or v20.x LTS ([Download Node.js](https://nodejs.org/))
2. **PostgreSQL:** v15 or v16 ([Download PostgreSQL](https://www.postgresql.org/download/))
3. **FFmpeg:** Installed and added to system `PATH` ([Download FFmpeg](https://ffmpeg.org/download.html))
4. **Tesseract OCR:** Installed locally for offline optical recognition (e.g., `tesseract` binary or `tesseract.js` cache)
5. **Git:** Installed on host

### 5.2 Repository Setup
```bash
# Clone the repository
git clone https://github.com/uzair592/carwash-management-system-.git
cd carwash-management-system-

# Install root dependencies
npm install
```

### 5.3 Database Configuration
1. Open PostgreSQL shell / pgAdmin and create the database:
   ```sql
   CREATE DATABASE carwash_db;
   CREATE USER carwash_admin WITH ENCRYPTED PASSWORD 'local_secure_pass';
   GRANT ALL PRIVILEGES ON DATABASE carwash_db TO carwash_admin;
   ```
2. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
3. Update `.env` with your local database credentials, Telegram Bot Token, Hikvision credentials, and Android SMS gateway IP.

### 5.4 Starting the Local Services
```bash
# Run Database Migrations
npm run db:migrate

# Start Backend Server (Port 5000)
npm run dev:server

# Start Frontend POS (Port 3000)
npm run dev:client

# Start Hardware Bridge Service (Isolated daemon)
npm run dev:bridge
```

---

## 6. Project Documentation Index

* **[ARCHITECTURE.md](file:///c:/Users/HP/Desktop/service%20management%20system/ARCHITECTURE.md)**: Full relational schema DDL, notification pipeline, and Hikvision ISAPI bridge architecture.
* **[ROADMAP.md](file:///c:/Users/HP/Desktop/service%20management%20system/ROADMAP.md)**: 5-Phase agentic execution plan from database foundation to investor dashboards.
* **[AGENT_DIRECTIVES.md](file:///c:/Users/HP/Desktop/service%20management%20system/AGENT_DIRECTIVES.md)**: Operational constraints, financial concurrency rules, and hardware decoupling standards for all Antigravity sub-agents.
