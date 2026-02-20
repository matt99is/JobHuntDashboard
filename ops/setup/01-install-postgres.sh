#!/usr/bin/env bash
set -euo pipefail

# Installs PostgreSQL on Ubuntu.
# Run: bash ops/setup/01-install-postgres.sh

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo is required."
  exit 1
fi

echo "Updating apt packages..."
sudo apt-get update

echo "Installing PostgreSQL..."
sudo apt-get install -y postgresql postgresql-contrib

echo "Enabling and starting PostgreSQL service..."
sudo systemctl enable --now postgresql

echo "Done. PostgreSQL installed and running."
