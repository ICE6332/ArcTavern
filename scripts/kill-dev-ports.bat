@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Usage:
rem   scripts\kill-dev-ports.bat 5000 5001
rem Default:
rem   5000 5001

if "%~1"=="" (
  set "PORTS=5000 5001"
) else (
  set "PORTS=%*"
)

echo cleaning dev ports: %PORTS%

for %%P in (%PORTS%) do (
  call :KillPort %%P
)

exit /b 0

:KillPort
set "PORT=%~1"

for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  set "PID=%%A"
  if not "!PID!"=="" (
    rem avoid killing system idle process
    if not "!PID!"=="0" (
      echo killing listener on :%PORT% (pid: !PID!)
      taskkill /F /PID !PID! >nul 2>&1
    )
  )
)

exit /b 0

