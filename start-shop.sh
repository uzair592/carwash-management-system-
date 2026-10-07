#!/usr/bin/env bash
# ===================================================================
#   CAR WASH & DETAILING MANAGEMENT SYSTEM - 1-CLICK STARTUP (UNIX)
# ===================================================================

set -e

echo "==================================================================="
echo "  CAR WASH & DETAILING MANAGEMENT SYSTEM - LOCAL PRODUCTION SETUP"
echo "==================================================================="
echo ""
echo "Starting Car Wash System Setup..."
echo ""

echo "[1/5] Installing dependencies..."
npm install

echo ""
echo "[2/5] Synchronizing PostgreSQL Database Schema..."
npx prisma db push

echo ""
echo "[3/5] Seeding Initial Day-1 Production Data..."
npx prisma db seed || echo "Seed warning encountered or data already initialized. Continuing..."

echo ""
echo "[4/5] Building Frontend Touch POS Interface..."
npm run build:ui

echo ""
echo "[5/5] Launching PM2 Background Process Supervisor..."
npx pm2 start ecosystem.config.js
npx pm2 save

echo ""
echo "==================================================================="
echo "  CAR WASH SYSTEM IS LIVE AND RUNNING IN BACKGROUND!"
echo "  Open http://localhost:3000 in your browser to access the POS."
echo "  Investor Portal: http://localhost:3000 (Tab 5)"
echo "  Backend API:     http://localhost:5000/api"
echo ""
echo "  To view process logs: npx pm2 logs"
echo "  To restart services:  npx pm2 restart all"
echo "  To stop services:     npx pm2 stop all"
echo "==================================================================="
