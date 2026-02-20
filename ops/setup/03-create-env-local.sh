#!/usr/bin/env bash
set -euo pipefail

# Creates .env.local from .env.example and fills key values.
# Usage:
#   API_BASE_URL=https://api.example.com \
#   DATABASE_URL=postgresql://jobhunt:pass@localhost:5432/jobhunt \
#   ADZUNA_APP_ID=... ADZUNA_APP_KEY=... \
#   JOB_SCORE_CUTOFF=12 \
#   bash ops/setup/03-create-env-local.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
fi

set_value() {
  local key="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    return 0
  fi

  if grep -q "^${key}=" .env.local; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env.local
  else
    echo "${key}=${value}" >> .env.local
  fi
}

set_value "VITE_API_BASE_URL" "${API_BASE_URL:-}"
set_value "DATABASE_URL" "${DATABASE_URL:-}"
set_value "ADZUNA_APP_ID" "${ADZUNA_APP_ID:-}"
set_value "ADZUNA_APP_KEY" "${ADZUNA_APP_KEY:-}"
set_value "JOB_SCORE_CUTOFF" "${JOB_SCORE_CUTOFF:-}"
set_value "CLAUDE_GATHER_ALLOWED_TOOLS" "${CLAUDE_GATHER_ALLOWED_TOOLS:-}"
set_value "SYSTEM_NOTIFY_SCRIPT" "${SYSTEM_NOTIFY_SCRIPT:-}"
set_value "SYSTEM_NOTIFY_PROJECT" "${SYSTEM_NOTIFY_PROJECT:-job-hunt-dashboard}"

echo ".env.local ready at $ROOT_DIR/.env.local"
