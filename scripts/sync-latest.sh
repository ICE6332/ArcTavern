#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

have() { command -v "$1" >/dev/null 2>&1; }

if ! have git; then
  echo "error: git not found" >&2
  exit 1
fi

if ! have pnpm; then
  echo "error: pnpm not found (install pnpm 10+ first)" >&2
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${current_branch}" == "HEAD" ]]; then
  echo "error: detached HEAD; please checkout a branch first" >&2
  exit 1
fi

target_branch="${1:-main}"

echo "syncing latest from origin/${target_branch}"
git fetch origin "${target_branch}"

if ! git show-ref --verify --quiet "refs/remotes/origin/${target_branch}"; then
  echo "error: origin/${target_branch} not found (did you pass the right branch?)" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree is dirty; please commit or stash changes before syncing" >&2
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/${target_branch}"; then
  git checkout "${target_branch}"
else
  git checkout -b "${target_branch}" "origin/${target_branch}"
fi

git pull --rebase --autostash origin "${target_branch}"

echo "installing dependencies"
pnpm install

echo "done"

