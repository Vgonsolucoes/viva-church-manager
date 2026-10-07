FROM node:20-bookworm-slim

ARG BUILD_TRIGGER="2026-10-07T20-31-00Z_NOCACHE_ADMIN_HEADERS_CACHE_CONTROL_NO_STORE_PROXY"
LABEL build.trigger="2026-10-07T20-31-00Z_NOCACHE_ADMIN_HEADERS_CACHE_CONTROL_NO_STORE_PROXY"
SHELL ["/bin/bash", "-c"]
RUN set -euxo pipefail; \
  UNIQUE_NS=$(awk 'BEGIN {srand(); printf "%d_%d", mktime("2026 10 07 20 31 00") + int(rand()*999999999), PROCINFO["pid"]} END {}'); \
  if [ -z "${UNIQUE_NS}" ]; then UNIQUE_NS="${RANDOM}_$$_$(date +%s)"; fi; \
  echo "START BUILD TRIGGER ${BUILD_TRIGGER} rnd=${UNIQUE_NS}" > /build_trigger.txt; \
  head -n 1 /build_trigger.txt;

WORKDIR /app

RUN set -euxo pipefail; \
  apt-get update; \
  apt-get install -y --no-install-recommends openssl ca-certificates; \
  rm -rf /var/lib/apt/lists/*; \
  apt-get clean;

ARG DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public
ARG NEXTAUTH_URL=http://localhost:3000
ARG NEXTAUTH_SECRET=build-only-secret
ARG APP_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
ARG TEMP_MEMBER_INTAKE_ENABLED=false
ENV DATABASE_URL=$DATABASE_URL
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV APP_ENCRYPTION_KEY=$APP_ENCRYPTION_KEY
ENV TEMP_MEMBER_INTAKE_ENABLED=$TEMP_MEMBER_INTAKE_ENABLED
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN set -euxo pipefail; \
  [ -d node_modules ] || rm -rf node_modules; \
  if [ -f /root/.npm/_cacache/package-json-cache.lock ]; then echo "[npm cache] using existing cache"; else npm cache clean --force || true; fi; \
  npm install --no-audit --no-fund --prefer-offline --loglevel=error;

COPY . .

RUN set -euxo pipefail; \
  rm -rf /app/.next /app/node_modules/.cache /app/out; \
  UNIQUE_BUILD=$(awk 'BEGIN {srand(); printf "BUILDID_%d_%d_%d", systime(), int(rand()*999999), PROCINFO["pid"]}'); \
  if [ -z "${UNIQUE_BUILD}" ]; then UNIQUE_BUILD="RND_${RANDOM}_$$_$(date +%s)"; fi; \
  echo "NEXT_PUBLIC_BUILD_ID=${UNIQUE_BUILD}" >> .env; \
  echo "PREBUILD_INVALIDATE=${UNIQUE_BUILD}" >> .env; \
  echo "NEXT_PUBLIC_BUILD_LABEL=BUILD_2026_10_07_MEMBERS_V3_SEM_MODE_SEM_ACTION_NO_CACHE_ADMIN" >> .env; \
  cat /build_trigger.txt; \
  echo "Build unique id: ${UNIQUE_BUILD}"; \
  npx prisma generate; \
  SKIP_ENV_VALIDATION=1 npm run build;

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

ENV BUILD_LABEL_STARTUP=BUILD_2026_10_07_MEMBERS_V3_SEM_MODE_SEM_ACTION_NO_CACHE_ADMIN
ENV NEXT_PUBLIC_BUILD_LABEL=BUILD_2026_10_07_MEMBERS_V3_SEM_MODE_SEM_ACTION_NO_CACHE_ADMIN

CMD ["sh", "-c", "echo '==============================='; echo 'START NEXT SERVER BUILD_LABEL='${BUILD_LABEL_STARTUP}; echo 'NEXT_PUBLIC_BUILD_LABEL='${NEXT_PUBLIC_BUILD_LABEL}; echo '==============================='; npx prisma migrate deploy && (npx prisma db seed || echo '[seed] WARN: seed did not complete successfully') && npm run start"]
