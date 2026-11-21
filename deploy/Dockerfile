# syntax=docker/dockerfile:1.7
# Imágenes de producción de peruwonderstours (monorepo pnpm). Contexto: raíz del repositorio.
#   docker build -f deploy/Dockerfile --target api   .
#   docker build -f deploy/Dockerfile --target web   .   (requiere la API arriba: ver deploy/scripts/deploy.sh)
#   docker build -f deploy/Dockerfile --target admin .
# Web y panel usan `output: "standalone"` (PWT_STANDALONE=1 en next.config.mjs).

ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
# Prisma detecta la versión de OpenSSL de la imagen; sin el paquete solo adivina (aviso en el deploy).
RUN apt-get update -q && apt-get install -yq --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.34.6 --activate
WORKDIR /repo

# --- Dependencias (capa cacheada mientras no cambie el lockfile) ---
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS source
COPY . .

# --- API (NestJS + Prisma) ---
FROM source AS api-build
# prisma.config.ts exige DATABASE_URL incluso para generar el cliente; aquí no se conecta a nada.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm --filter @pwt/api exec prisma generate \
 && pnpm --filter @pwt/api exec tsc -p tsconfig.build.json

FROM base AS api
ENV NODE_ENV=production
# Las migraciones (prisma migrate deploy) y el seed corren desde esta misma imagen.
COPY --from=api-build /repo /repo
WORKDIR /repo/apps/api
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]

# --- Web pública (Next.js standalone) ---
FROM source AS web-build
# Valores públicos que Next incrusta al compilar (cambiarlos exige un nuevo build).
ARG NEXT_PUBLIC_GA_ID=""
ARG NEXT_PUBLIC_PAYMENTS_MODE="sandbox"
ARG NEXT_PUBLIC_WHATSAPP_NUMBER="51989028802"
ARG PUBLIC_WEB_BASE_URL
ARG MEDIA_PUBLIC_BASE_URL
# Durante el build la web lee el catálogo de la API por el puerto local del servidor (127.0.0.1).
ARG API_BASE_URL="http://127.0.0.1:13001/api/v1"
ENV NODE_ENV=production PWT_STANDALONE=1 \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID NEXT_PUBLIC_PAYMENTS_MODE=$NEXT_PUBLIC_PAYMENTS_MODE \
    NEXT_PUBLIC_WHATSAPP_NUMBER=$NEXT_PUBLIC_WHATSAPP_NUMBER PUBLIC_WEB_BASE_URL=$PUBLIC_WEB_BASE_URL \
    MEDIA_PUBLIC_BASE_URL=$MEDIA_PUBLIC_BASE_URL API_BASE_URL=$API_BASE_URL API_ALLOW_HTTP=true \
    NODE_OPTIONS=--max-old-space-size=3072
WORKDIR /repo/apps/web
RUN node scripts/build-messages.mjs && node scripts/build-maintenance-page.mjs && pnpm exec next build --webpack

FROM ${NODE_IMAGE} AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=web-build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build --chown=node:node /repo/apps/web/public ./apps/web/public
# Caché del optimizador de imágenes (volumen en compose.yml): debe existir y ser del usuario node para
# que el volumen nuevo herede el dueño y las fotos convertidas sobrevivan a cada despliegue.
RUN mkdir -p apps/web/.next/cache && chown -R node:node apps/web/.next/cache
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# --- Panel de administración (Next.js standalone) ---
FROM source AS admin-build
ENV NODE_ENV=production PWT_STANDALONE=1 NODE_OPTIONS=--max-old-space-size=2048
WORKDIR /repo/apps/admin
RUN pnpm exec next build --webpack

FROM ${NODE_IMAGE} AS admin
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=admin-build --chown=node:node /repo/apps/admin/.next/standalone ./
COPY --from=admin-build --chown=node:node /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=admin-build --chown=node:node /repo/apps/admin/public ./apps/admin/public
USER node
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
