#!/bin/sh
set -e

mkdir -p /config/www
cp -f /app/house-comms-card.js /config/www/house-comms-card.js
echo "[house-comms] Carte Lovelace copiée dans /config/www/house-comms-card.js"

exec node /app/index.js
