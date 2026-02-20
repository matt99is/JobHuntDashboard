#!/usr/bin/env bash
set -euo pipefail

# Quick local checks after setup.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local"
  exit 1
fi

echo "1) Build check"
npm run build >/tmp/jobhunt-build.log

echo "2) API health check"
node server/index.js >/tmp/jobhunt-api.log 2>&1 &
API_PID=$!
trap 'kill "$API_PID" >/dev/null 2>&1 || true' EXIT
sleep 2
SMOKE_API_URL="${SMOKE_API_URL:-http://localhost:${API_PORT:-8788}}"
curl -fsS "${SMOKE_API_URL}/health" >/tmp/jobhunt-health.json

kill "$API_PID" >/dev/null 2>&1 || true
trap - EXIT

echo "3) Database count check"
node scripts/check-db-count.js >/tmp/jobhunt-dbcount.log 2>&1 || true

echo "Smoke test complete."
echo "Health response:"
cat /tmp/jobhunt-health.json
