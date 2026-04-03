#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

bash "${root_dir}/scripts/kill-dev-ports.sh" 5001 || true

cd "${root_dir}"
exec pnpm dev:server

