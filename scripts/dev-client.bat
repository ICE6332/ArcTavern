@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0.."

call "%~dp0kill-dev-ports.bat" 5000
if errorlevel 1 (
  echo Failed to clean port 5000
  exit /b 1
)

cd /d "%ROOT_DIR%"
pnpm dev:client

