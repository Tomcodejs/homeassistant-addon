#!/bin/sh
# L'image de base pufferpanel/pufferpanel n'inclut pas bashio/s6-overlay,
# donc ce script reste en shell POSIX simple (pas de dependance Home Assistant).
#
# IMPORTANT : le config.json par defaut de l'image pointe vers des chemins
# NON persistants (a l'interieur du conteneur). Home Assistant recree le
# conteneur a chaque demarrage, donc tout ce qui n'est pas sous /data est
# perdu. On genere ici un config.json complet DANS /data au premier lancement,
# avec tous les chemins (base de donnees incluse) explicitement dans /data,
# puis on demarre TOUJOURS avec --config /data/config.json.

set -e

CONFIG_FILE=/data/config.json

echo "[PufferPanel Add-on] Preparation de l'environnement..."

mkdir -p /data/tmp
export TMPDIR=/data/tmp

if [ ! -f "$CONFIG_FILE" ]; then
    echo "[PufferPanel Add-on] Premier demarrage : creation de la configuration persistante dans /data..."
    mkdir -p /data/servers /data/logs

    SESSION_KEY=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')

    cat > "$CONFIG_FILE" << CONF
{
  "daemon": {
    "data": {
      "root": "/data/servers"
    }
  },
  "logs": "/data/logs",
  "security": {
    "forceOpenat": true
  },
  "panel": {
    "database": {
      "dialect": "sqlite3",
      "url": "file:/data/database.db"
    },
    "sessionkey": "$SESSION_KEY",
    "web": {
      "files": "/var/www/pufferpanel"
    }
  },
  "web": {
    "host": "0.0.0.0:8080"
  }
}
CONF
else
    echo "[PufferPanel Add-on] Configuration existante trouvee dans /data, on la reutilise."
fi

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
            pufferpanel --config "$CONFIG_FILE" user add "$USERNAME" --email "$EMAIL" --password "$PASSWORD" --admin \
                && touch "$MARKER" \
                && echo "[PufferPanel Add-on] Utilisateur ${USERNAME} cree avec succes (admin)." \
                || echo "[PufferPanel Add-on] Echec de la creation (l'utilisateur existe peut-etre deja)."
        else
            pufferpanel --config "$CONFIG_FILE" user add "$USERNAME" --email "$EMAIL" --password "$PASSWORD" \
                && touch "$MARKER" \
                && echo "[PufferPanel Add-on] Utilisateur ${USERNAME} cree avec succes (non-admin)." \
                || echo "[PufferPanel Add-on] Echec de la creation (l'utilisateur existe peut-etre deja)."
        fi
    fi
fi

echo "[PufferPanel Add-on] Demarrage de PufferPanel..."
exec pufferpanel runService --config "$CONFIG_FILE"
