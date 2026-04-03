@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0.."
pushd "%ROOT_DIR%" >nul

call "%~dp0kill-dev-ports.bat" 5000 5001

echo starting server first...
start "ArcTavern Server" cmd /c "pnpm dev:server"

REM give server a moment to start so client proxy has a target
ping 127.0.0.1 -n 2 >nul

echo starting client...
start "ArcTavern Client" cmd /c "pnpm dev:client"

popd >nul
endlocal

