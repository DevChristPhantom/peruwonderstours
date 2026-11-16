#!/usr/bin/env bash
# Genera las variables de peruwonderstours en el SERVIDOR, con secretos aleatorios que nunca se
# muestran en pantalla ni van al repositorio. Ejecutar como deploy:
#   bash deploy/scripts/gen-env.sh prueba.peruwonderstours.com panel.peruwonderstours.com
# No sobrescribe archivos existentes (rotar un secreto = borrar ese archivo y volver a correrlo,
# salvo PII_ENCRYPTION_KEY: perderla deja ilegibles los datos personales cifrados).
set -euo pipefail

WEB_DOMAIN="${1:?Uso: gen-env.sh <dominio-web> <dominio-panel>}"
ADMIN_DOMAIN="${2:?Uso: gen-env.sh <dominio-web> <dominio-panel>}"
ENV_DIR="${PWT_ENV_DIR:-/srv/peruwonderstours/env}"
WEB_URL="https://${WEB_DOMAIN}"

umask 077
install -d -m 700 "$ENV_DIR"
rand() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-"${1:-48}"; }

write() { # write <archivo> : escribe stdin solo si el archivo no existe
  local file="$ENV_DIR/$1"
  if [[ -e "$file" ]]; then echo "    ya existe, no se toca: $file"; cat >/dev/null; return; fi
  cat > "$file"; chmod 600 "$file"; echo "    creado: $file"
}

# La contraseña de la base se reutiliza si db.env ya existe (api.env la necesita igual).
if [[ -e "$ENV_DIR/db.env" ]]; then
  DB_PASSWORD="$(grep '^POSTGRES_PASSWORD=' "$ENV_DIR/db.env" | cut -d= -f2-)"
else
  DB_PASSWORD="$(rand 40)"
fi
REVALIDATE_SECRET="$(rand 48)"
[[ -e "$ENV_DIR/web.env" ]] && REVALIDATE_SECRET="$(grep '^REVALIDATE_SECRET=' "$ENV_DIR/web.env" | cut -d= -f2-)"

echo "==> Variables en $ENV_DIR"
write db.env <<EOF
POSTGRES_USER=pwt
POSTGRES_DB=pwt
POSTGRES_PASSWORD=${DB_PASSWORD}
EOF

write api.env <<EOF
NODE_ENV=production
# Fase de pruebas: pasarela simulada (no cobra). Al lanzar: STAGING=false y la pasarela real.
STAGING=true
PAYMENT_GATEWAY=sandbox
SANDBOX_WEBHOOK_SECRET=$(rand 40)
PORT=3001
DATA_SOURCE=prisma
DATABASE_URL=postgresql://pwt:${DB_PASSWORD}@db:5432/pwt
SEED_DATA_DIR=/repo/data/seed
WEB_ORIGIN=${WEB_URL}
PUBLIC_WEB_BASE_URL=${WEB_URL}
MEDIA_STORAGE=local
MEDIA_PUBLIC_BASE_URL=${WEB_URL}/media
# Solo la web y el panel (red privada de Docker) hablan con la API.
TRUST_PROXY=uniquelocal
SWAGGER_ENABLED=false
PII_ENCRYPTION_KEY=$(openssl rand -base64 32)
JWT_ACCESS_SECRET=$(rand 64)
MARKETING_LINK_SECRET=$(rand 48)
# Datos legales confirmados por el cliente (Consulta RUC SUNAT, 2026-10-24).
PROVIDER_LEGAL_NAME=PERU WONDERS TOURS S.A.C.
PROVIDER_RUC=20616102339
ESTABLISHMENT_ADDRESS=Jr. Amauta Mza. X Lote 15, Urb. Tepro (Centro Poblado Salcedo), Puno - Puno - Puno
# Correo: apagado hasta contratar el proveedor SMTP (luego MAIL_TRANSPORT=smtp y SMTP_*).
MAIL_TRANSPORT=disabled
EOF

write web.env <<EOF
NODE_ENV=production
# Red privada de Docker (no sale del servidor ni se expone a internet): por eso http y la
# excepción explícita a H-19. La web nunca llama a la API por una red pública.
API_BASE_URL=http://api:3001/api/v1
API_ALLOW_HTTP=true
CATALOG_SOURCE=api
PAYMENT_PROVIDER=sandbox
PUBLIC_WEB_BASE_URL=${WEB_URL}
# Caddy entrega una sola IP (la real del visitante) en X-Forwarded-For.
TRUSTED_PROXY_HOPS=1
REVALIDATE_SECRET=${REVALIDATE_SECRET}
EOF

write admin.env <<EOF
NODE_ENV=production
API_BASE_URL=http://api:3001/api/v1
ADMIN_SESSION_SECRET=$(rand 64)
PUBLIC_WEB_BASE_URL=${WEB_URL}
MEDIA_PUBLIC_BASE_URL=${WEB_URL}/media
TRUSTED_PROXY_HOPS=1
REVALIDATE_SECRET=${REVALIDATE_SECRET}
# Aviso de cambios a la web por la red interna (sin pasar por la contraseña de la fase de pruebas).
WEB_REVALIDATE_URLS=http://web:3000/api/revalidate
EOF

# Variables que Docker Compose usa al compilar (no son secretas).
write deploy.env <<EOF
PWT_PUBLIC_WEB_BASE_URL=${WEB_URL}
PWT_MEDIA_PUBLIC_BASE_URL=${WEB_URL}/media
PWT_ADMIN_DOMAIN=${ADMIN_DOMAIN}
PWT_PAYMENTS_MODE=sandbox
# ID de Google Analytics del cliente (G-XXXXXXXXXX). Vacío = sin analítica ni aviso de cookies.
PWT_GA_ID=
PWT_API_HOST_PORT=13001
EOF

echo
echo "Guarda una copia de $ENV_DIR/api.env en un gestor de contraseñas: contiene PII_ENCRYPTION_KEY,"
echo "sin la cual una copia de seguridad de la base no sirve para leer los datos personales."
