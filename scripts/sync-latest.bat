@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0.."
pushd "%ROOT_DIR%" >nul

where git >nul 2>&1
if errorlevel 1 (
  echo error: git not found
  popd >nul
  exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  echo error: pnpm not found ^(install pnpm 10+ first^)
  popd >nul
  exit /b 1
)

set "TARGET_BRANCH=%~1"
if "%TARGET_BRANCH%"=="" set "TARGET_BRANCH=main"

echo syncing latest from origin/%TARGET_BRANCH%
git fetch origin %TARGET_BRANCH%
if errorlevel 1 (
  echo error: git fetch failed
  popd >nul
  exit /b 1
)

git pull --rebase --autostash origin %TARGET_BRANCH%
if errorlevel 1 (
  echo error: git pull failed
  popd >nul
  exit /b 1
)

echo installing dependencies
pnpm install
if errorlevel 1 (
  echo error: pnpm install failed
  popd >nul
  exit /b 1
)

echo done
popd >nul
endlocal

