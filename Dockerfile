FROM node:20-bookworm-slim

ARG BUILD_TRIGGER=2026-09-21T20-15-00Z_FORCE_REBUILD_ADMINSHELL_AVATAR_SAFE_IMAGE
LABEL build.trigger="2026-09-21T20-15-00Z_FORCE_REBUILD_ADMINSHELL_AVATAR_SAFE_IMAGE"
RUN echo "BUILD_TRIGGER force layer rebuild ${BUILD_TRIGGER}" > /dev/null

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

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
RUN npm install

COPY . .

RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && (npx prisma db seed || echo '[seed] WARN: seed did not complete successfully') && npm run start"]
