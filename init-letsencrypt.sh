#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# init-letsencrypt.sh
# Run this ONCE on the server to obtain the first Let's Encrypt certificate.
# After this, the certbot service in docker-compose.yml handles renewals.
#
# Usage:
#   chmod +x init-letsencrypt.sh
#   ./init-letsencrypt.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

DOMAIN="keluarga-buchori.com"
EMAIL="admin@keluarga-buchori.com"   # ← change to a real email (renewal alerts)
STAGING=0                             # set to 1 to test without hitting rate limits

# ── 1. Create a temporary self-signed cert so nginx can start on 443 ─────────
echo "### Creating temporary self-signed certificate..."
docker compose run --rm --entrypoint "sh -c '
  mkdir -p /etc/letsencrypt/live/${DOMAIN} &&
  openssl req -x509 -nodes -newkey rsa:2048 -days 1
    -keyout /etc/letsencrypt/live/${DOMAIN}/privkey.pem
    -out    /etc/letsencrypt/live/${DOMAIN}/fullchain.pem
    -subj   \"/CN=localhost\" 2>/dev/null
'" certbot

# ── 2. Start nginx (it can now load the dummy cert) ──────────────────────────
echo "### Starting proxy (nginx)..."
docker compose up -d proxy
echo "### Waiting for nginx to be ready..."
sleep 3

# ── 3. Delete the dummy cert, then request the real one ──────────────────────
echo "### Removing temporary certificate..."
docker compose run --rm --entrypoint "sh -c '
  rm -rf /etc/letsencrypt/live/${DOMAIN}
  rm -rf /etc/letsencrypt/archive/${DOMAIN}
  rm -f  /etc/letsencrypt/renewal/${DOMAIN}.conf
'" certbot

STAGING_ARG=""
[ "$STAGING" -eq 1 ] && STAGING_ARG="--staging"

echo "### Requesting Let's Encrypt certificate for ${DOMAIN} and www.${DOMAIN}..."
docker compose run --rm --entrypoint "
  certbot certonly --webroot
    --webroot-path=/var/www/certbot
    ${STAGING_ARG}
    --email ${EMAIL}
    -d ${DOMAIN}
    -d www.${DOMAIN}
    --rsa-key-size 4096
    --agree-tos
    --no-eff-email
    --force-renewal
" certbot

# ── 4. Reload nginx so it picks up the real cert ─────────────────────────────
echo "### Reloading nginx..."
docker compose exec proxy nginx -s reload

# ── 5. Start the certbot renewal service ─────────────────────────────────────
echo "### Starting certbot renewal service..."
docker compose up -d certbot

echo ""
echo "✅  Done! https://${DOMAIN} is now secured with Let's Encrypt."
echo "    Certificates will auto-renew every 12 h via the certbot service."
