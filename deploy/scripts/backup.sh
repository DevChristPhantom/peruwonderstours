#!/usr/bin/env bash
# Copia de seguridad diaria de peruwonderstours: base de datos (pg_dump) + medios subidos desde el
# panel. Guarda 14 días en /srv/backups/peruwonderstours y, si hay un remoto de rclone configurado
# (RCLONE_REMOTE, p. ej. "b2:pwt-backups"), sube una copia fuera del servidor.
#
# Cron (como deploy):  15 3 * * *  bash /srv/peruwonderstours/app/deploy/scripts/backup.sh >> /srv/backups/backup.log 2>&1
#
# Restaurar: ver docs/manual/despliegue.md, sección «Copias de seguridad».
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_DIR="${PWT_ENV_DIR:-/srv/peruwonderstours/env}"
DEST_ROOT="${PWT_BACKUP_DIR:-/srv/backups/peruwonderstours}"
KEEP_DAYS="${PWT_BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"
DEST="$DEST_ROOT/$STAMP"
C=(docker compose -f "$REPO/deploy/compose.yml" --env-file "$ENV_DIR/deploy.env")

umask 077
mkdir -p "$DEST"
echo "[$(date -Is)] Copia en $DEST"

# Base de datos: formato custom (pg_restore permite restaurar todo o por tablas).
"${C[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner' > "$DEST/db.dump"

# Medios subidos (fotos, videos y portadas de banners).
docker run --rm -v peruwonderstours_uploads:/data:ro -v "$DEST":/backup alpine:3.21 \
  tar -czf /backup/uploads.tar.gz -C /data .

# Comprobación mínima: los archivos no pueden estar vacíos.
[[ -s "$DEST/db.dump" && -s "$DEST/uploads.tar.gz" ]] || { echo "ERROR: copia vacía" >&2; exit 1; }
sha256sum "$DEST"/* > "$DEST/SHA256SUMS"

# Fuera del servidor (opcional pero recomendado).
if [[ -n "${RCLONE_REMOTE:-}" ]] && command -v rclone >/dev/null; then
  rclone copy "$DEST" "$RCLONE_REMOTE/$STAMP" --quiet
  echo "    subida a $RCLONE_REMOTE/$STAMP"
fi

# Retención local.
find "$DEST_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +
echo "[$(date -Is)] OK ($(du -sh "$DEST" | cut -f1))"
