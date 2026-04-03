@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0.."

call "%~dp0kill-dev-ports.bat" 5001
if errorlevel 1 (
  rem non-fatal: continue
)

cd /d "%ROOT_DIR%"
pnpm dev:server

