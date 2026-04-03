#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"${ROOT_DIR}/scripts/kill-dev-ports.sh" 5000

cd "${ROOT_DIR}"
pnpm dev:client

