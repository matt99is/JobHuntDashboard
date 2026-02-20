#!/usr/bin/env bash
set -euo pipefail

# Installs the weekly pipeline timer as a user-level systemd timer.
# Schedule: Monday 07:00 GMT/UTC

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"

mkdir -p "$SYSTEMD_USER_DIR"
cp "$ROOT_DIR/ops/systemd/jobhunt-pipeline.service" "$SYSTEMD_USER_DIR/jobhunt-pipeline.service"
cp "$ROOT_DIR/ops/systemd/jobhunt-pipeline.timer" "$SYSTEMD_USER_DIR/jobhunt-pipeline.timer"

systemctl --user daemon-reload
systemctl --user enable --now jobhunt-pipeline.timer

echo "Timer installed."
systemctl --user list-timers jobhunt-pipeline.timer --all
