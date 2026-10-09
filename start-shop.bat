@echo off
cd /d "%~dp0"
TITLE DF PRO - Start shop
node scripts/shop-launch.js
if errorlevel 1 pause
