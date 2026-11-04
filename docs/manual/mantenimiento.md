# Página de mantenimiento

La web tiene una sola página de mantenimiento (fuente: `apps/web/src/lib/maintenance/maintenance.mjs`)
que se usa en dos situaciones. En ambas responde **503 + `Retry-After: 600`**: Google entiende que es
temporal y no saca las páginas del buscador.

## 1. Mantenimiento planificado (la web sigue encendida)

Para cambios en la base de datos o tareas largas, sin apagar la web:

1. Poner `MAINTENANCE_MODE=on` en las variables de entorno de la web.
2. Reiniciar el proceso de la web.

Todas las páginas muestran el aviso. Siguen respondiendo las rutas `/api/` y los archivos (imágenes, íconos).
El panel de administración es otra aplicación y no se ve afectado.

Para volver: quitar la variable (o `MAINTENANCE_MODE=off`) y reiniciar.

## 2. La web está apagada (despliegue o caída)

Si el proceso de Next no responde, Next no puede mostrar nada. Lo muestra el servidor de delante con el
archivo estático `apps/web/public/mantenimiento.html`.

Después de cambiar el texto o el número de WhatsApp, regenerarlo:

```bash
node apps/web/scripts/build-maintenance-page.mjs
```

La prueba `apps/web/test/maintenance-page.test.mjs` falla si el archivo quedó desactualizado.

### nginx

```nginx
server {
  # ... server_name, certificados, etc.

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_intercept_errors on;
    # "=503": el visitante recibe 503 (temporal) aunque la web haya fallado con 502 o 504.
    error_page 502 503 504 =503 /mantenimiento.html;
  }

  location = /mantenimiento.html {
    root /ruta/al/proyecto/apps/web/public;
    internal;
    add_header Retry-After 600 always;
    add_header Cache-Control "no-store" always;
  }
}
```

> `proxy_intercept_errors on` también reemplaza los 503 que envía la propia web en el modo 1. Es el mismo
> contenido, así que no hay diferencia para el visitante.

### Caddy

```caddy
peruwonderstours.com {
  reverse_proxy 127.0.0.1:3000

  handle_errors 502 503 504 {
    root * /ruta/al/proyecto/apps/web/public
    rewrite * /mantenimiento.html
    header Retry-After 600
    header Cache-Control no-store
    file_server {
      status 503
    }
  }
}
```

## Comprobar

- Modo 1: con `MAINTENANCE_MODE=on`, `curl -I https://peruwonderstours.com/es` debe dar `503` y `Retry-After: 600`.
- Modo 2: con la web detenida, la misma petición debe mostrar la página de mantenimiento, no un error del servidor.
