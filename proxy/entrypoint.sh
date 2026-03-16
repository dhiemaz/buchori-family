#!/bin/sh
# Custom nginx entrypoint.
# If no real Let's Encrypt cert exists yet, create a temporary self-signed cert
# so nginx can start on port 443. Run ./init-letsencrypt.sh to replace it with
# a real cert without downtime.

CERT="/etc/letsencrypt/live/keluarga-buchori.com/fullchain.pem"
KEY="/etc/letsencrypt/live/keluarga-buchori.com/privkey.pem"

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  echo "[proxy] No SSL certificate found — generating temporary self-signed cert..."
  mkdir -p "$(dirname "$CERT")"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$KEY" \
    -out    "$CERT" \
    -subj   "/CN=localhost" 2>/dev/null
  echo "[proxy] Temporary cert created. Run ./init-letsencrypt.sh on the server to get the real Let's Encrypt cert."
fi

# Hand off to the default nginx entrypoint + CMD
exec /docker-entrypoint.sh "$@"
