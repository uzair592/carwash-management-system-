@echo off
TITLE Car Wash Management System - 1-Click Production Startup
COLOR 0B

echo ===================================================================
echo   CAR WASH & DETAILING MANAGEMENT SYSTEM - LOCAL PRODUCTION SETUP
echo ===================================================================
echo.
echo Starting Car Wash System Setup...
echo.

echo [1/5] Installing root and backend dependencies...
call npm install
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install failed. Please verify Node.js and network connectivity.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/5] Synchronizing PostgreSQL Database Schema...
call npx prisma db push
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Prisma db push failed. Please verify PostgreSQL is running.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [3/5] Seeding Initial Day-1 Production Data...
call npx prisma db seed
IF %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Database seeding returned a warning or data already exists. Continuing...
)

echo.
echo [4/5] Building Frontend Touch POS Interface...
call npm run build:ui
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend UI build failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [5/5] Launching PM2 Background Process Supervisor...
call npx pm2 start ecosystem.config.js
call npx pm2 save

echo.
echo ===================================================================
echo   CAR WASH SYSTEM IS LIVE AND RUNNING IN BACKGROUND!
echo   Open http://localhost:3000 in your browser to access the POS.
echo   Investor Portal: http://localhost:3000 (Tab 5)
echo   Backend API:     http://localhost:5000/api
echo.
echo   To view process logs: npx pm2 logs
echo   To restart services:  npx pm2 restart all
echo   To stop services:     npx pm2 stop all
echo ===================================================================
echo.
pause
