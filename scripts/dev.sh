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

# Bash 3.2 (macOS default) doesn't support `wait -n`.
# Don't use "wait -n && exit 0" as it would treat child failures as "no support".
if (( BASH_VERSINFO[0] > 4 )) || (( BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 3 )); then
  wait -n "${SERVER_PID}" "${CLIENT_PID}"
  exit_code=$?
  exit "${exit_code}"
fi

echo "note: bash does not support 'wait -n'; falling back to PID polling"
while true; do
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
    wait "${SERVER_PID}"
    exit $?
  fi
  if ! kill -0 "${CLIENT_PID}" 2>/dev/null; then
    wait "${CLIENT_PID}"
    exit $?
  fi
  sleep 0.5
done
