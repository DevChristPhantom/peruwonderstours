#!/usr/bin/env bash
# Publica la versión actual del repositorio en el VPS. Ejecutar como deploy desde la copia del
# repositorio (/srv/peruwonderstours/app):
#   bash deploy/scripts/deploy.sh            # trae los cambios de GitHub y despliega
#   bash deploy/scripts/deploy.sh --no-pull  # despliega lo que ya está en la carpeta
#
# Orden: base de datos → migraciones → API → web y panel (la web se compila leyendo el catálogo
# real de la API) → Caddy → refresco de caché. Mientras la web reinicia, Caddy muestra la página
# de mantenimiento.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_DIR="${PWT_ENV_DIR:-/srv/peruwonderstours/env}"
PROXY_DIR="${PWT_PROXY_DIR:-/srv/proxy}"
cd "$REPO"

for f in db api web admin deploy; do
  [[ -f "$ENV_DIR/$f.env" ]] || { echo "Falta $ENV_DIR/$f.env: corre deploy/scripts/gen-env.sh primero." >&2; exit 1; }
done
docker network inspect proxy >/dev/null 2>&1 || { echo "Falta el proxy compartido (red \"proxy\"): ver docs/manual/despliegue.md." >&2; exit 1; }

if [[ "${1:-}" != "--no-pull" ]]; then
  echo "==> Código: git pull"
  git pull --ff-only
fi
echo "    Versión: $(git log -1 --format='%h %s')"

C=(docker compose -f deploy/compose.yml --env-file "$ENV_DIR/deploy.env")
export DOCKER_BUILDKIT=1

echo "==> Base de datos"
"${C[@]}" up -d --wait db

echo "==> API: compilar y migrar"
"${C[@]}" build api
"${C[@]}" run --rm --no-deps api sh -c 'node "$(node -p "require.resolve(\"prisma/build/index.js\")")" migrate deploy'
"${C[@]}" up -d --wait api

echo "==> Web y panel: compilar (la web lee el catálogo real de la API)"
"${C[@]}" build web admin

echo "==> Caddy: sitio y página de mantenimiento"
install -m 644 deploy/proxy/sites/peruwonderstours.caddy "$PROXY_DIR/sites/peruwonderstours.caddy"
install -d "$PROXY_DIR/static/peruwonderstours"
install -m 644 apps/web/public/mantenimiento.html "$PROXY_DIR/static/peruwonderstours/mantenimiento.html"
docker compose -f "$PROXY_DIR/compose.yml" exec -T caddy caddy reload --config /etc/caddy/Caddyfile

echo "==> Web y panel: reiniciar"
"${C[@]}" up -d --wait web admin

echo "==> Refrescar la caché de la web"
"${C[@]}" exec -T web node -e '
  fetch("http://127.0.0.1:3000/api/revalidate", {
    method: "POST",
    headers: { "content-type": "application/json", "x-revalidate-secret": process.env.REVALIDATE_SECRET },
    body: JSON.stringify({ tags: ["catalog", "departures", "content", "testimonials", "hero-banners", "promotions"] }),
  }).then((r) => { console.log("    revalidate", r.status); process.exit(r.ok ? 0 : 1); })
    .catch((e) => { console.error(e); process.exit(1); });'

echo "==> Limpieza de imágenes viejas"
docker image prune -f >/dev/null

echo
echo "Despliegue listo: $(grep '^PWT_PUBLIC_WEB_BASE_URL=' "$ENV_DIR/deploy.env" | cut -d= -f2-)"
