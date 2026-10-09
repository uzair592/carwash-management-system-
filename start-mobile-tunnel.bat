@echo off
setlocal
cd /d "%~dp0"
title DF PRO - Mobile Quick Tunnel
node scripts\quick-tunnel.js
if errorlevel 1 (
  echo.
  echo The mobile tunnel did not start. Read the message above, then press any key.
  pause >nul
)
endlocal
