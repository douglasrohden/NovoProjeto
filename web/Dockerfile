FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    libxml2-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci

# Modelos Tesseract (português + inglês fallback) — evita download em runtime
RUN mkdir -p /app/tessdata && \
    curl -fsSL -o /app/tessdata/por.traineddata.gz \
        https://tessdata.projectnaptha.com/4.0.0/por.traineddata.gz && \
    curl -fsSL -o /app/tessdata/eng.traineddata.gz \
        https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz

COPY . .

RUN npx prisma generate && npm run build

RUN chmod +x docker/entrypoint-web.sh docker/entrypoint-worker.sh

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV TESSDATA_PATH=/app/tessdata
ENV XML_SCHEMA_PATH=/app/docs/xml-schema.xsd
ENV UPLOAD_DIR=/data/uploads

RUN mkdir -p /data/uploads

EXPOSE 3000

# Padrão: API web (worker usa entrypoint próprio no compose)
CMD ["./docker/entrypoint-web.sh"]
