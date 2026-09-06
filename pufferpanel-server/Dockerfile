ARG BUILD_FROM
FROM pufferpanel/pufferpanel:latest

# jq est necessaire pour lire les options de l'addon (username/email/password/is_admin)
# depuis /data/options.json, quel que soit le gestionnaire de paquets de l'image de base
RUN if command -v apk >/dev/null 2>&1; then \
        apk add --no-cache jq; \
    else \
        apt-get update && apt-get install -y --no-install-recommends jq && rm -rf /var/lib/apt/lists/*; \
    fi

COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
