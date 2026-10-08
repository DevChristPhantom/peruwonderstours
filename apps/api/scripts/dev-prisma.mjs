// `pnpm dev:prisma`: API en modo PostgreSQL (DATA_SOURCE=prisma) en el puerto 3001 con
// recarga (`nest start --watch`). ConfigModule lee `.env` (DATABASE_URL); las variables de
// este proceso tienen prioridad sobre `.env`. Sin SANDBOX_WEBHOOK_SECRET en `.env` se
// genera uno efímero (solo desarrollo; los webhooks firmados con otro secreto fallarán).
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const envFile = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
const definedInEnvFile = (key) => new RegExp(String.raw`^\s*${key}\s*=\s*\S`, 'm').test(envFile);

if (!process.env.DATABASE_URL && !definedInEnvFile('DATABASE_URL')) {
  console.error('dev:prisma: falta DATABASE_URL en apps/api/.env (ver .env.example).');
  process.exit(1);
}

const env = { ...process.env, NODE_ENV: 'development', DATA_SOURCE: 'prisma', PORT: process.env.PORT ?? '3001', DEMO_PRICING: 'false' };
if (!process.env.SANDBOX_WEBHOOK_SECRET && !definedInEnvFile('SANDBOX_WEBHOOK_SECRET')) {
  env.SANDBOX_WEBHOOK_SECRET = randomBytes(32).toString('hex');
  console.warn('dev:prisma: SANDBOX_WEBHOOK_SECRET efímero generado (defínelo en .env para firmar webhooks de prueba).');
}
if (!process.env.SANDBOX_CHECKOUT_BASE_URL && !definedInEnvFile('SANDBOX_CHECKOUT_BASE_URL')) {
  env.SANDBOX_CHECKOUT_BASE_URL = `http://localhost:${env.PORT}/api/v1/sandbox/checkout`;
}

const nest = require.resolve('@nestjs/cli/bin/nest.js');
const child = spawn(process.execPath, [nest, 'start', '--watch', ...process.argv.slice(2)], { stdio: 'inherit', env });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
