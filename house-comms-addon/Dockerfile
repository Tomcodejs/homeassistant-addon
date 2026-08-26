FROM node:20-alpine

WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY index.js .
COPY house-comms-card.js .
COPY run.sh .
RUN chmod +x run.sh

# Home Assistant Supervisor automatically maps a persistent /data folder
# for every add-on - no volume config needed on your side.
# The "config:rw" map (see config.yaml) exposes HA's config folder at /config,
# which lets the add-on copy the Lovelace card into /config/www on its own.
ENV DATA_DIR=/data
ENV PORT=8091

EXPOSE 8091
CMD ["./run.sh"]
