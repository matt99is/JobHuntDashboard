#!/usr/bin/env bash
set -euo pipefail

# Keeps user-level timers running even when user is not logged in.
# Requires sudo once.

USER_NAME="${USER}"
sudo loginctl enable-linger "$USER_NAME"
loginctl show-user "$USER_NAME" -p Linger
