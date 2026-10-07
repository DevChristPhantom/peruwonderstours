# @pwt/ui

Design tokens (y, más adelante, componentes) de Peru Wonders Tours.
Fuente de verdad del diseño: `design-system/peru-wonders-tours/MASTER.md`.

## Archivos

| Archivo | Qué es |
|---|---|
| `src/tokens.css` | Variables CSS `--pwt-*` en `:root`: primitivos (titicaca, terracota, selva, dorado, piedra, noche), semánticos claro/oscuro, hero, tipografía, espaciado, radios, sombras, z-index, movimiento y su versión reducida. CSS puro, sin Tailwind. |
| `src/theme.css` | Puente para Tailwind v4 (`@theme inline`): expone los tokens como utilidades (`bg-accent`, `text-foreground-muted`, `rounded-lg`, `shadow-overlay`, `font-display`, `text-h2`, `ease-out`, `nav:`…). |
| `src/tokens.ts` | Los mismos valores tipados (`camelCase`, `as const`) para GSAP, anime.js, OG images y emails. |

## Uso (Next.js + Tailwind v4)

```css
/* apps/web/app/globals.css */
@import "tailwindcss";
@import "@pwt/ui/tokens.css";
@import "@pwt/ui/theme.css";
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *, .dark, .dark *));
```

```ts
import { motion, colors } from '@pwt/ui/tokens';
gsap.registerPlugin(CustomEase);
CustomEase.create('pwt', motion.bezier.out.join(','));
```

Agrega `"@pwt/ui": "workspace:*"` a la app consumidora. El paquete no tiene dependencias;
`tokens.ts` se consume como fuente (Next.js: `transpilePackages: ['@pwt/ui']`).

## Temas

- Claro por defecto. Oscuro automático con `prefers-color-scheme: dark` salvo `data-theme="light"`.
- Forzar: `<html data-theme="dark">` (o clase `.dark`) / `<html data-theme="light">`.
- El hero usa siempre los tokens `--pwt-hero-*` (oscuros) en ambos temas.
- `prefers-reduced-motion: reduce` lleva duraciones a `0.01ms`, delays y stagger a 0 y blur a 0.
  En JS, usa `gsap.matchMedia()` con `REDUCED_MOTION_QUERY`.

## Reglas

- No uses hex sueltos en componentes: usa tokens semánticos (`--pwt-accent`, no `--pwt-terracota-600`).
- Un solo botón `accent` por vista. Dorado (`highlight`) nunca como texto sobre fondos claros.
- Si cambias un valor, cámbialo en `tokens.css`, `tokens.ts` y `MASTER.md` (los tres).
