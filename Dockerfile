FROM node:20-alpine

WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY index.js .

# Home Assistant Supervisor automatically maps a persistent /data folder
# for every add-on - no volume config needed on your side.
ENV DATA_DIR=/data
ENV PORT=8091

EXPOSE 8091
CMD ["node", "index.js"]
