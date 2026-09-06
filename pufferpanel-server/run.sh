#!/bin/sh
# L'image de base pufferpanel/pufferpanel n'inclut pas bashio/s6-overlay,
# donc ce script reste en shell POSIX simple (pas de dependance Home Assistant),
# et lit /data/options.json directement avec jq.

set -e

echo "[PufferPanel Add-on] Preparation de l'environnement..."

mkdir -p /data/tmp
export TMPDIR=/data/tmp

OPTIONS_FILE=/data/options.json

if [ -f "$OPTIONS_FILE" ]; then
    CREATE_USER=$(jq -r '.create_user // false' "$OPTIONS_FILE")
    USERNAME=$(jq -r '.username // empty' "$OPTIONS_FILE")
    EMAIL=$(jq -r '.email // empty' "$OPTIONS_FILE")
    PASSWORD=$(jq -r '.password // empty' "$OPTIONS_FILE")
    IS_ADMIN=$(jq -r '.is_admin // true' "$OPTIONS_FILE")
else
    CREATE_USER="false"
fi

if [ "$CREATE_USER" = "true" ] && [ -n "$USERNAME" ] && [ -n "$PASSWORD" ]; then
    MARKER="/data/.user_${USERNAME}_created"

    if [ -f "$MARKER" ]; then
        echo "[PufferPanel Add-on] L'utilisateur ${USERNAME} a deja ete cree precedemment, on ignore."
    else
        echo "[PufferPanel Add-on] Creation de l'utilisateur ${USERNAME} (admin: ${IS_ADMIN})..."

        if [ "$IS_ADMIN" = "true" ]; then
            pufferpanel user add "$USERNAME" --email "$EMAIL" --password "$PASSWORD" --admin \
                && touch "$MARKER" \
                && echo "[PufferPanel Add-on] Utilisateur ${USERNAME} cree avec succes (admin)." \
                || echo "[PufferPanel Add-on] Echec de la creation (l'utilisateur existe peut-etre deja)."
        else
            pufferpanel user add "$USERNAME" --email "$EMAIL" --password "$PASSWORD" \
                && touch "$MARKER" \
                && echo "[PufferPanel Add-on] Utilisateur ${USERNAME} cree avec succes (non-admin)." \
                || echo "[PufferPanel Add-on] Echec de la creation (l'utilisateur existe peut-etre deja)."
        fi
    fi
fi

echo "[PufferPanel Add-on] Demarrage de PufferPanel..."
exec pufferpanel runService --workDir /data
