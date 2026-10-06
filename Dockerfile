FROM node:20-bookworm-slim

ARG BUILD_TRIGGER="2026-10-06T20-33-00Z_NOCACHE_AGGRESSIVE_EASYPANEL_DOCKER_CACHE_BUST_1314507152_MEMBERS_FIX"
LABEL build.trigger="2026-10-06T20-33-00Z_NOCACHE_AGGRESSIVE_EASYPANEL_DOCKER_CACHE_BUST_1314507152_MEMBERS_FIX"

SHELL ["/bin/bash", "-c"]
RUN set -euxo pipefail; \
  echo "START BUILD TRIGGER ${BUILD_TRIGGER} $(date +%s%N)" > /build_trigger.txt; \
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
  npm cache clean --force || true; \
  rm -rf /root/.npm /app/node_modules; \
  npm install --no-audit --no-fund --prefer-offline=false;

COPY . .

RUN set -euxo pipefail; \
  rm -rf /app/.next /app/node_modules/.cache /app/out; \
  echo "PREBUILD_INVALIDATE=$(date +%s%N) ${BUILD_TRIGGER}" >> .env; \
  cat /build_trigger.txt; \
  npx prisma generate; \
  SKIP_ENV_VALIDATION=1 npm run build;

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && (npx prisma db seed || echo '[seed] WARN: seed did not complete successfully') && npm run start"]
