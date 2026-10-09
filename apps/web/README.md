This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Seguridad HTTP (H-02, H-07, H-18, H-19)

- `src/proxy.ts`: CSP con nonce por petición (`script-src 'nonce' 'strict-dynamic'`, `<style>` con nonce)
  en las rutas dinámicas sensibles (checkout, reserva y pago, Libro de Reclamaciones, privacidad,
  comparador). Las páginas SSG/ISR del catálogo no pueden llevar nonce: su CSP permite scripts en línea
  (`'unsafe-inline'`) pero ningún origen externo de script. En todas: `frame-ancestors 'none'`,
  `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, HSTS con preload (prod), nosniff,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
  `CSP_REPORT_ONLY=true` la envía como Report-Only.
- `TRUSTED_PROXY_HOPS` (por defecto 0): la IP del visitante que se reenvía a la API es la entrada N-ésima
  desde la derecha de `X-Forwarded-For`; nunca la primera. El proxy de entrada debe sobrescribir o anexar
  la cabecera con la IP del socket (nginx: `proxy_set_header X-Forwarded-For $remote_addr;`).
- En producción `API_BASE_URL` debe ser `https://` (`API_ALLOW_HTTP=true` solo para `next start` local).
- `public/sw-voucher.js`: la copia offline del voucher caduca a los 30 días o 7 días después del último
  día de servicio (`data-pwt-voucher-last-day`), lo que ocurra primero; se borra al detectar 401/403/404/410.
