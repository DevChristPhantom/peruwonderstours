# deploy/

Producción en un VPS con Docker. Guía completa paso a paso: [docs/manual/despliegue.md](../docs/manual/despliegue.md).

| Archivo | Qué es |
|---|---|
| `Dockerfile` | Imágenes de `api`, `web` y `admin` (targets). Web y panel en modo standalone (`PWT_STANDALONE=1`). |
| `compose.yml` | Proyecto peruwonderstours: PostgreSQL 16, API, web y panel, con límites de memoria. |
| `proxy/` | Caddy compartido por todos los proyectos del VPS (HTTPS automático, un archivo por sitio). |
| `scripts/server-setup.sh` | Preparación única de Ubuntu 24.04 (Docker, usuario deploy, firewall, fail2ban, swap). |
| `scripts/gen-env.sh` | Genera las variables y secretos en el servidor (nunca en el repositorio). |
| `scripts/deploy.sh` | Publica: migraciones, compilación, reinicio y refresco de caché. |
| `scripts/backup.sh` | Copia diaria de la base y de los medios subidos (local + rclone opcional). |
