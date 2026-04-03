#!/usr/bin/env bash
set -euo pipefail

PORTS="${*:-5000 5001}"

have() { command -v "$1" >/dev/null 2>&1; }

kill_port_lsof() {
  local port="$1"
  local pids
  pids="$(lsof -ti "TCP:${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "killing listeners on :${port} (pids: ${pids//$'\n'/ })"
    kill -TERM ${pids} 2>/dev/null || true
    sleep 0.2 || true
    kill -KILL ${pids} 2>/dev/null || true
  fi
}

kill_port_fuser() {
  local port="$1"
  if fuser -n tcp "${port}" >/dev/null 2>&1; then
    echo "killing listeners on :${port}"
    fuser -k -TERM -n tcp "${port}" >/dev/null 2>&1 || true
    sleep 0.2 || true
    fuser -k -KILL -n tcp "${port}" >/dev/null 2>&1 || true
  fi
}

echo "cleaning dev ports: ${PORTS}"
for port in ${PORTS}; do
  if have lsof; then
    kill_port_lsof "${port}"
  elif have fuser; then
    kill_port_fuser "${port}"
  else
    echo "warning: neither 'lsof' nor 'fuser' found; skipping port cleanup for :${port}" >&2
  fi
done

