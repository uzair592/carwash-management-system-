@echo off
cd /d "%~dp0"
TITLE DF PRO - First installation
call npm ci
if errorlevel 1 goto fail
node scripts/shop-setup.js install
if errorlevel 1 goto fail
pause
exit /b 0
:fail
echo Setup stopped. Read the error above. No automatic database reset was attempted.
pause
exit /b 1
