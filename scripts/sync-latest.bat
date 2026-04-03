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
git fetch --prune origin
if errorlevel 1 (
  echo error: git fetch failed
  popd >nul
  exit /b 1
)

REM refuse to run on dirty working tree (avoid autostash surprises)
for /f %%A in ('git status --porcelain') do set "DIRTY=1"
if defined DIRTY (
  echo error: working tree is dirty; please commit or stash changes before syncing
  popd >nul
  exit /b 1
)

REM verify remote branch exists
git show-ref --verify --quiet refs/remotes/origin/%TARGET_BRANCH%
if errorlevel 1 (
  echo error: remote branch "origin/%TARGET_BRANCH%" not found
  popd >nul
  exit /b 1
)

REM ensure local branch exists and checkout target branch
git show-ref --verify --quiet refs/heads/%TARGET_BRANCH%
if errorlevel 1 (
  git checkout -b %TARGET_BRANCH% origin/%TARGET_BRANCH%
  if errorlevel 1 (
    echo error: failed to create local branch %TARGET_BRANCH%
    popd >nul
    exit /b 1
  )
) else (
  git checkout %TARGET_BRANCH%
  if errorlevel 1 (
    echo error: failed to checkout branch %TARGET_BRANCH%
    popd >nul
    exit /b 1
  )
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

