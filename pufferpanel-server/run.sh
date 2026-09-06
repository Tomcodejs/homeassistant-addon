#!/bin/sh
# L'image de base pufferpanel/pufferpanel n'inclut pas bashio/s6-overlay,
# donc ce script reste en shell POSIX simple (pas de dépendance Home Assistant).

echo "[PufferPanel Add-on] Preparation de l'environnement..."

mkdir -p /data/tmp
export TMPDIR=/data/tmp

echo "[PufferPanel Add-on] Demarrage de PufferPanel..."
exec pufferpanel runService --workDir /data
