FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY index.js .
ENV DATA_DIR=/data
ENV PORT=8091
VOLUME ["/data"]
EXPOSE 8091
CMD ["node", "index.js"]
