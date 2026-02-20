#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_FILE="$REPO_ROOT/.locks/pipeline.lock"
LOG_FILE="$REPO_ROOT/logs/pipeline-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$REPO_ROOT/.locks" "$REPO_ROOT/logs"

cd "$REPO_ROOT"

if [[ -f .env.local ]]; then
  # shellcheck disable=SC1091
  set -a
  source .env.local
  set +a
fi

{
  echo "[$(date -Is)] Starting weekly AI pipeline"
  flock -n 9 node scripts/run-ai-pipeline.js
  EXIT_CODE=$?
  echo "[$(date -Is)] Pipeline finished with exit code $EXIT_CODE"
  exit "$EXIT_CODE"
} 9>"$LOCK_FILE" | tee -a "$LOG_FILE"
