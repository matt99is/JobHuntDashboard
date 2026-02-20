#!/usr/bin/env bash
set -euo pipefail

# Configure nginx reverse proxy for Job Hunt API.
# Usage:
#   API_DOMAIN=api.jobs.mattlelonek.co.uk bash ops/setup/09-configure-nginx-api.sh

API_DOMAIN="${API_DOMAIN:-api.jobs.mattlelonek.co.uk}"
API_PORT="${API_PORT:-8788}"

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo is required."
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "Installing nginx..."
  sudo apt-get update
  sudo apt-get install -y nginx
fi

SITE_PATH="/etc/nginx/sites-available/jobhunt-api"

sudo tee "$SITE_PATH" >/dev/null <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${API_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX

sudo ln -sf "$SITE_PATH" /etc/nginx/sites-enabled/jobhunt-api
sudo nginx -t
sudo systemctl reload nginx

echo "Nginx API proxy configured for http://${API_DOMAIN} -> http://127.0.0.1:${API_PORT}"
