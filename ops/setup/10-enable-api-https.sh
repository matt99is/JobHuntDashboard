#!/usr/bin/env bash
set -euo pipefail

# Enable HTTPS for API domain with certbot.
# Usage:
#   API_DOMAIN=api.jobs.mattlelonek.co.uk EMAIL=you@example.com bash ops/setup/10-enable-api-https.sh

API_DOMAIN="${API_DOMAIN:-api.jobs.mattlelonek.co.uk}"
EMAIL="${EMAIL:-}"

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo is required."
  exit 1
fi

if [[ -z "$EMAIL" ]]; then
  echo "Set EMAIL=you@example.com when running this script."
  exit 1
fi

echo "Installing certbot nginx plugin..."
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

echo "Requesting certificate for ${API_DOMAIN}..."
sudo certbot --nginx -d "$API_DOMAIN" --redirect -m "$EMAIL" --agree-tos --no-eff-email

echo "HTTPS enabled."
