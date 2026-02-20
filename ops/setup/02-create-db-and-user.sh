#!/usr/bin/env bash
set -euo pipefail

# Creates database + user for Job Hunt Dashboard.
# Optional env overrides:
#   DB_NAME=jobhunt DB_USER=jobhunt DB_PASSWORD='strong-pass' bash ops/setup/02-create-db-and-user.sh

DB_NAME="${DB_NAME:-jobhunt}"
DB_USER="${DB_USER:-jobhunt}"
DB_PASSWORD="${DB_PASSWORD:-change-me-now}"

echo "Creating postgres role/database if needed..."

sudo -u postgres psql <<SQL
DO
\$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi

echo "Done."
echo "DATABASE_URL=postgresql://${DB_USER}:********@localhost:5432/${DB_NAME}"
