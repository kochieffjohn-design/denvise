# Образ ядра Denvise. Собирается на машине в Yandex Cloud скриптом deploy/deploy.sh.
FROM node:24-slim

ENV NODE_ENV=production \
    TZ=UTC \
    PORT=8788

WORKDIR /app

# Корневой сертификат Yandex Cloud: Managed PostgreSQL принимает только TLS,
# ядро проверяет сертификат базы (sslmode=verify-full в DATABASE_URL)
ADD --chmod=644 https://storage.yandexcloud.net/cloud-certs/CA.pem /app/yandex-ca.pem

COPY package.json package-lock.json ./
# --omit=peer: не ставить необязательные «парные» пакеты better-auth (vitest и т.п.)
RUN npm ci --omit=dev --omit=peer && npm cache clean --force

COPY tsconfig.json ./
COPY src ./src
COPY drizzle ./drizzle

USER node
EXPOSE 8788

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--import", "tsx", "src/server.ts"]
