#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

PORTS="${PORTS:-5000 5001}"

cleanup() {
  "${SCRIPT_DIR}/kill-dev-ports.sh" ${PORTS} >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

"${SCRIPT_DIR}/kill-dev-ports.sh" ${PORTS}

cd "${REPO_ROOT}"

echo "starting server first..."
pnpm dev:server &
SERVER_PID=$!

sleep 0.8

echo "starting client..."
pnpm dev:client &
CLIENT_PID=$!

have() { command -v "$1" >/dev/null 2>&1; }

# Bash 3.2 (macOS default) doesn't support `wait -n`.
if wait -n "${SERVER_PID}" "${CLIENT_PID}" 2>/dev/null; then
  exit 0
fi

echo "note: bash does not support 'wait -n'; falling back to PID polling"
while true; do
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
    wait "${SERVER_PID}" 2>/dev/null || true
    exit 0
  fi
  if ! kill -0 "${CLIENT_PID}" 2>/dev/null; then
    wait "${CLIENT_PID}" 2>/dev/null || true
    exit 0
  fi
  sleep 0.5
done
