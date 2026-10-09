@echo off
cd /d "%~dp0"
TITLE DF PRO - Update installation
node scripts/shop-launch.js stop
if errorlevel 1 goto fail
call npm ci
if errorlevel 1 goto fail
node scripts/shop-setup.js update
if errorlevel 1 goto fail
pause
exit /b 0
:fail
echo Update stopped. Keep the shop closed until the error is resolved.
pause
exit /b 1
