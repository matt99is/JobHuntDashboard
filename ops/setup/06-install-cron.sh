#!/usr/bin/env bash
set -euo pipefail

# Installs weekly cron trigger (alternative to systemd timer).
# Schedule: Monday 07:00 GMT/UTC

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CRON_LINE="0 7 * * 1 $ROOT_DIR/ops/run-pipeline.sh"
MARKER="# jobhunt-weekly-pipeline"

TMP_FILE="$(mktemp)"
crontab -l 2>/dev/null | grep -v "$MARKER" > "$TMP_FILE" || true
{
  cat "$TMP_FILE"
  echo "$MARKER"
  echo "$CRON_LINE"
} | crontab -
rm -f "$TMP_FILE"

echo "Cron installed:"
crontab -l | sed -n '/jobhunt-weekly-pipeline/,+1p'
