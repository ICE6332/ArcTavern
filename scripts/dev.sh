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

wait -n "${SERVER_PID}" "${CLIENT_PID}"
