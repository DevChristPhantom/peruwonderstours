# Despliegue en el VPS (Hostinger KVM 2 u otro Ubuntu 24.04)

Todo lo necesario está en `deploy/`. Esta guía va en orden: se hace una vez (secciones 1–6) y
después solo se usa la sección 7 para publicar cambios.

```
Internet → Cloudflare (DNS, CDN, protección) → Caddy compartido (HTTPS, un archivo por sitio)
                                                  ├─ prueba.peruwonderstours.com → pwt-web:3000   (y /media → pwt-api)
                                                  ├─ panel.peruwonderstours.com  → pwt-admin:3000
                                                  └─ (otros proyectos del mismo VPS)
          peruwonderstours (red privada): db (PostgreSQL 16) ← api (NestJS) ← web + admin (Next.js)
```

- **Varios proyectos en el mismo VPS**: un solo Caddy (`/srv/proxy`) con un archivo por sitio en
  `sites/`. Cada proyecto tiene su carpeta, su `compose.yml`, su base de datos y sus secretos.
- **Límites de memoria** (8 GB en total): db 1 GB, API 768 MB, web 768 MB, panel 512 MB, Caddy 256 MB.
  Queda espacio para otros proyectos. La compilación de la web usa hasta ~3 GB por unos minutos.
- **Puerto reservado**: `127.0.0.1:13001` (API, solo para compilar la web). Otro proyecto no debe usarlo.

## 1. Lo que hace el dueño de las cuentas (no se comparten contraseñas)

1. **Hostinger → VPS**: sistema **Ubuntu 24.04** (limpio, sin panel). Ubicación: Brasil si está
   disponible; si no, EE. UU. La contraseña de root la guarda el dueño.
2. **Llave SSH**: en tu PC, `ssh-keygen -t ed25519 -C "deploy peruwonderstours"` (la privada no sale de
   tu PC). La **pública** (`~/.ssh/id_ed25519.pub`) se pega en Hostinger → VPS → Claves SSH.
3. **Cloudflare** (gratis): agregar `peruwonderstours.com` y, en Namecheap, cambiar los servidores DNS
   por los dos que indique Cloudflare.
4. **DNS en Cloudflare** (registros A hacia la IP del VPS):
   `prueba` y `panel` → IP del VPS, al principio en **gris (solo DNS)** para que Caddy obtenga los
   certificados; cuando la web responda por https, pasarlos a **naranja (proxy)**.
   SSL/TLS → modo **Full (strict)**.

> Si al renovar un certificado (cada ~60 días, automático) Caddy no lo logra con el proxy naranja,
> usar un **Certificado de origen de Cloudflare** (SSL/TLS → Origin Server) y `tls` en el sitio. Se
> verifica en el servidor la primera vez.

## 2. Preparar el servidor (una vez, como root)

```bash
ssh root@IP_DEL_VPS
curl -fsSLO https://raw.githubusercontent.com/DevChristPhantom/peruwonderstours/feature/sprint-3-funcional/deploy/scripts/server-setup.sh
bash server-setup.sh
```

Instala Docker, crea el usuario `deploy` (entra con la misma llave), firewall (solo 22, 80, 443),
fail2ban, actualizaciones automáticas de seguridad, 2 GB de swap y hora de Lima. Si la llave ya está,
desactiva el acceso por contraseña. Desde aquí se trabaja como `deploy`: `ssh deploy@IP_DEL_VPS`.

## 3. Proxy compartido (una vez por servidor)

```bash
git clone https://github.com/DevChristPhantom/peruwonderstours.git /srv/peruwonderstours/app
cd /srv/peruwonderstours/app && git checkout feature/sprint-3-funcional
cp deploy/proxy/compose.yml deploy/proxy/Caddyfile /srv/proxy/
cp deploy/proxy/proxy.env.example /srv/proxy/proxy.env && chmod 600 /srv/proxy/proxy.env
nano /srv/proxy/proxy.env          # ACME_EMAIL, dominios
cd /srv/proxy && docker compose up -d
docker compose exec caddy caddy hash-password   # escribe la contraseña de la fase de pruebas
nano /srv/proxy/proxy.env          # pega el hash en PWT_STAGING_HASH (entre comillas simples)
docker compose up -d --force-recreate
```

> Si el repositorio pasa a privado: crear una *deploy key* de solo lectura en GitHub y clonar por SSH.

## 4. Variables y secretos (una vez)

```bash
cd /srv/peruwonderstours/app
bash deploy/scripts/gen-env.sh prueba.peruwonderstours.com panel.peruwonderstours.com
```

Crea `/srv/peruwonderstours/env/{db,api,web,admin,deploy}.env` (permisos 600) con claves aleatorias que
no se muestran. **Guardar una copia de `api.env` en un gestor de contraseñas**: tiene
`PII_ENCRYPTION_KEY`, sin la cual una copia de la base no permite leer los datos personales.

Arranca en **fase de pruebas**: `STAGING=true`, pagos simulados, correo apagado, contraseña en la web
y fuera de Google.

## 5. Primer despliegue

```bash
bash deploy/scripts/deploy.sh --no-pull
```

La primera vez tarda (descarga de imágenes y compilación). Después:

**Contenido inicial** (elegir uno):
- **A. Catálogo base** (41 tours, destinos y blog, sin precios):
  `docker compose -f deploy/compose.yml --env-file /srv/peruwonderstours/env/deploy.env run --rm api node dist/database/seed/run-seed.js --publish`
- **B. Traer lo trabajado en la demo** (banners, eventos, textos editados en el panel): volcado de la
  base de la demo y de `apps/api/uploads` en la PC, sin las tarifas DEMO
  (`run-seed.js --remove-demo-pricing` antes de volcar). Se hace acompañado: no hay que subir reservas
  ni datos personales de prueba.

**Primer usuario del panel** (la contraseña la escribe la persona, oculta):
```bash
docker compose -f deploy/compose.yml --env-file /srv/peruwonderstours/env/deploy.env run --rm -it api \
  node dist/cli/admin-create.js --email correo@dominio.com --name "Nombre Apellido"
```
Al entrar al panel por primera vez pide activar la verificación en dos pasos.

## 6. Copias de seguridad (una vez)

```bash
crontab -e
# 15 3 * * *  bash /srv/peruwonderstours/app/deploy/scripts/backup.sh >> /srv/backups/backup.log 2>&1
```

Base de datos + fotos y videos subidos, 14 días en `/srv/backups/peruwonderstours`. **Fuera del
servidor** (recomendado): instalar `rclone`, configurar Backblaze B2 o Cloudflare R2 y definir
`RCLONE_REMOTE` (p. ej. en el crontab: `RCLONE_REMOTE=b2:pwt-backups`).

Restaurar la base (con la web detenida):
```bash
C="docker compose -f deploy/compose.yml --env-file /srv/peruwonderstours/env/deploy.env"
$C stop web admin api
$C exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < /srv/backups/peruwonderstours/FECHA/db.dump
docker run --rm -v peruwonderstours_uploads:/data -v /srv/backups/peruwonderstours/FECHA:/b alpine sh -c 'cd /data && tar -xzf /b/uploads.tar.gz'
$C up -d api web admin
```

## 7. Publicar cambios (día a día)

1. En la PC: commit y `git push` a la rama.
2. En el servidor: `ssh deploy@IP_DEL_VPS` → `cd /srv/peruwonderstours/app && bash deploy/scripts/deploy.sh`

   Si la conexión es inestable, lanzarlo desacoplado (sigue aunque se corte el SSH) y mirar el registro:
   ```bash
   setsid nohup bash deploy/scripts/deploy.sh > /srv/peruwonderstours/deploy.log 2>&1 < /dev/null &
   tail -f /srv/peruwonderstours/deploy.log      # Ctrl+C solo deja de mirar; el despliegue sigue
   ```

Aplica migraciones, recompila y reinicia. Durante el reinicio Caddy muestra la página de mantenimiento.
Para mantenimiento planificado con la web encendida: `MAINTENANCE_MODE=on` en `web.env` y
`docker compose ... up -d web` (ver `docs/manual/mantenimiento.md`).

**Google Analytics**: poner el ID en `PWT_GA_ID` de `deploy.env` y volver a desplegar (se incrusta al
compilar).

## 8. Agregar otro proyecto al mismo VPS

1. Su propia carpeta en `/srv/<proyecto>` con su `compose.yml`; sus servicios públicos se unen a la red
   externa `proxy` con **alias únicos** (p. ej. `miapp-web`), sin publicar puertos.
2. Un archivo `/srv/proxy/sites/<proyecto>.caddy` con su dominio y `import upstream miapp-web:3000`.
3. `cd /srv/proxy && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`.
4. Ponerle `mem_limit` a cada servicio y revisar `free -h`: peruwonderstours usa ~3,3 GB como máximo.

## 9. Lanzamiento (salir de la fase de pruebas)

- [ ] Precios reales en soles y en dólares cargados en el panel.
- [ ] Textos legales revisados por el abogado (quitar el aviso de BORRADOR).
- [ ] Pasarela real contratada: en `api.env` `PAYMENT_GATEWAY` y sus claves; en `web.env`
      `PAYMENT_PROVIDER`; en `deploy.env` `PWT_PAYMENTS_MODE`.
- [ ] Correo: proveedor SMTP en `api.env` (`MAIL_TRANSPORT=smtp`, `SMTP_*`, remitente del dominio).
- [ ] `STAGING=false` en `api.env`.
- [ ] Dominio: `PWT_WEB_DOMAIN=peruwonderstours.com` en `proxy.env`; en `sites/peruwonderstours.caddy`
      quitar `basic_auth` y `X-Robots-Tag` y activar el bloque `www`; cambiar el dominio en `*.env`
      (`gen-env.sh` no pisa archivos: editar a mano `PUBLIC_WEB_BASE_URL`, `WEB_ORIGIN`,
      `MEDIA_PUBLIC_BASE_URL` y `PWT_PUBLIC_WEB_BASE_URL`/`PWT_MEDIA_PUBLIC_BASE_URL`).
- [ ] DNS: registros `@` y `www` en Cloudflare.
- [ ] `PWT_GA_ID` con el ID real.
- [ ] `deploy.sh` y revisar la web, una reserva de prueba y el panel.

## 10. Problemas comunes

| Síntoma | Revisar |
|---|---|
| La web muestra «Estamos mejorando la web» | `docker compose -f deploy/compose.yml ps` y `logs web` / `logs api` |
| La API no arranca | `logs api`: la validación lista exactamente qué variable falta o es inválida |
| Certificado no se emite | DNS en gris (solo DNS) mientras se emite; `docker compose logs caddy` en `/srv/proxy` |
| Fotos subidas no se ven | `MEDIA_PUBLIC_BASE_URL` igual en `api.env`, `admin.env` y `deploy.env`; redeploy |
| Poca memoria | `docker stats`; los `mem_limit` del compose; swap con `free -h` |
