---
type: decision
title: Marca peruwonderstours y logo del cliente
status: accepted
created: 2026-10-14
updated: 2026-10-14
---

# ADR-0013 — Marca definitiva y logo del cóndor

El cliente confirma que Andean Peru Tours es el sitio de origen del rediseño y que la marca/dominio nueva es peruwonderstours.com. Proporciona el PNG del cóndor; se utiliza ese archivo exacto, transparente, sin recolorear ni alterar proporciones, en header/footer/checkout y login admin. El componente compartido presenta sus márgenes transparentes sin fondo; se retiró el marco blanco por petición explícita del cliente. SVG provisionales descartados. Copias web/admin conservan SHA256 322655dac896eeacb52f32bc80a1f76c7f6ea9eeb7f636c0da042785ed27f367.

Se unifica el nombre peruwonderstours en SITE, diccionarios es/en, SEO/metadata, admin, calendarios y plantillas de correo/MFA. Dominio canonical ya configurado como https://peruwonderstours.com. Contacto confirmado: jorgechaveztourt@gmail.com y +51 924278597; no se inventan buzones del dominio, razón social ni RUC.

Las redes de Andean se mantienen archivadas y no se publican hasta confirmar perfiles nuevos. Reseñas importadas origin legacy_site permanecen en datos/panel, excluidas del listado público y del fallback web; no se renombra una cita de viajero. Blog editorial propio actualiza marca y evita transferir la afirmación heredada de 30 años. URLs de fotografías y redirecciones de origen se conservan para no romper recursos/rutas; no representan canonical de marca.

Validación local: tipos de web/admin/API aprobados; lint web/admin y oxlint API aprobados; 9 pruebas web y 29 pruebas API afectadas/reparadas aprobadas, incluida regresión de exclusión de reseñas. Primera ejecución API: 230/232, con expectativa de QR de marca antigua y socket bloqueado; ambos casos aprobaron en el reintento focalizado. Diccionarios 1096 claves por idioma correctos. No se migró ni modificó la base del cliente ni se publicó producción. GitHub repite compilación y suite Chromium tras el commit.


## Logo definitivo dorado

El cliente proporciona su propio diseño dorado y pide sustituir el anterior. Se usa peruwonderstours-dorado.png, PNG transparente 2171x724, SHA256 29665b1e690908a381d8749e4e9cd5305539ab9fa3149dba94a22d7691210cd6, copiado sin alterar a web/admin. Se retiran recortes del componente porque este diseño ocupa todo el lienzo: imagen completa con altura automática y sin fondo. El header usa 186px (146px móvil), footer220px y login280px; Next sirve tamaños adaptados. Tipos/lint web y admin aprobados.
