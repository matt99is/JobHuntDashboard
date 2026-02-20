#!/usr/bin/env bash
set -euo pipefail

# Installs user-level API service.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"

mkdir -p "$SYSTEMD_USER_DIR"
cp "$ROOT_DIR/ops/systemd/jobhunt-api.service" "$SYSTEMD_USER_DIR/jobhunt-api.service"

systemctl --user daemon-reload
systemctl --user enable --now jobhunt-api.service

echo "API service installed and started."
systemctl --user status jobhunt-api.service --no-pager -n 40 || true
