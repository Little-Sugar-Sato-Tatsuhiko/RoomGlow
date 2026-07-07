#!/usr/bin/env bash
# Polls origin/main for new commits and applies them to this checkout.
# Intended to run periodically (e.g. via systemd timer, see deploy/systemd/)
# on a Docker Compose deployment where server/src are bind-mounted with
# hot-reload already enabled (see README "開発環境（Docker Compose）").
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

BRANCH="main"

git fetch origin "$BRANCH"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "[auto-pull] Already up to date ($LOCAL)."
  exit 0
fi

echo "[auto-pull] Updating $LOCAL -> $REMOTE"

DEP_CHANGED=false
if git diff --name-only "$LOCAL" "$REMOTE" | grep -qE '^(package\.json|package-lock\.json)$'; then
  DEP_CHANGED=true
fi

if ! git pull --ff-only origin "$BRANCH"; then
  echo "[auto-pull] Fast-forward pull failed (local changes on this machine?). Aborting." >&2
  exit 1
fi

if [ "$DEP_CHANGED" = true ]; then
  echo "[auto-pull] package.json changed, rebuilding the container image..."
  docker compose up -d --build
else
  echo "[auto-pull] Source-only change; tsx watch / Vite HMR picks it up without a restart."
fi

echo "[auto-pull] Done."
