#!/usr/bin/env bash
set -euo pipefail

# Applies local DB schema.
# Requires .env.local with DATABASE_URL or DB_* values.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local. Run ops/setup/03-create-env-local.sh first."
  exit 1
fi

npm run db:init

echo "Schema initialized."
