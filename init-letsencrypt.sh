#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# init-letsencrypt.sh
# Run this ONCE on the server to obtain the first Let's Encrypt certificate.
# After this, the certbot service in docker-compose.yml handles renewals.
#
# Prerequisites:
#   - DNS A records for keluarga-buchori.com and www.keluarga-buchori.com
#     must point to this server's public IP.
#   - docker compose up -d must already be running (proxy serves ACME challenge).
#
# Usage:
#   chmod +x init-letsencrypt.sh
#   ./init-letsencrypt.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

DOMAIN="keluarga-buchori.com"
EMAIL="admin@keluarga-buchori.com"   # ← change to a real email (used for renewal alerts)
STAGING=0                             # set to 1 to test without hitting rate limits

STAGING_ARG=""
[ "$STAGING" -eq 1 ] && STAGING_ARG="--staging"

# ── 1. Make sure the proxy (nginx) is running ─────────────────────────────────
echo "### Ensuring proxy is running..."
docker compose up -d proxy
echo "### Waiting for nginx to be ready..."
sleep 3

# ── 2. Clear any dummy/stale cert that would block certbot ───────────────────
# The proxy entrypoint creates a self-signed cert so nginx can start.
# Certbot doesn't know about it and refuses to overwrite the "live" directory.
echo "### Removing temporary self-signed certificate..."
docker compose run --rm --entrypoint sh certbot -c \
  "rm -rf /etc/letsencrypt/live/${DOMAIN} \
          /etc/letsencrypt/archive/${DOMAIN} \
          /etc/letsencrypt/renewal/${DOMAIN}.conf"

# ── 3. Request the real certificate ──────────────────────────────────────────
# --entrypoint certbot overrides the renewal-loop entrypoint set in docker-compose.yml
echo "### Requesting Let's Encrypt certificate for ${DOMAIN} and www.${DOMAIN}..."
docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  $STAGING_ARG \
  --email "$EMAIL" \
  -d "$DOMAIN" \
  -d "www.$DOMAIN" \
  --agree-tos \
  --no-eff-email \
  --force-renewal

# ── 4. Reload nginx so it picks up the real cert ─────────────────────────────
echo "### Reloading nginx..."
docker compose exec proxy nginx -s reload

# ── 5. Start / restart the certbot renewal service ───────────────────────────
echo "### Starting certbot renewal service..."
docker compose up -d certbot

echo ""
echo "✅  Done! https://${DOMAIN} is now secured with a real Let's Encrypt certificate."
echo "    Certificates will auto-renew every 12 h via the certbot service."
