import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import pg from 'pg';

/**
 * Base de datos de pruebas end-to-end con PostgreSQL real (`pwt_test`, mismo servidor que
 * DATABASE_URL). Se RECREA en cada corrida (DROP ... WITH (FORCE)) y se migra con
 * `prisma migrate deploy`: las pruebas HTTP no pueden revertirse por transacción y nunca deben
 * ensuciar `pwt_dev`. TEST_DATABASE_URL permite apuntar a otra base.
 */
export const TEST_DATABASE_NAME = 'pwt_test';

export function testDatabaseUrl(): string | null {
  if (process.env['TEST_DATABASE_URL']) return process.env['TEST_DATABASE_URL'];
  const base = process.env['DATABASE_URL'];
  if (!base) return null;
  const url = new URL(base);
  url.pathname = `/${TEST_DATABASE_NAME}`;
  return url.toString();
}

function adminUrl(target: string): string {
  const url = new URL(target);
  url.pathname = '/postgres';
  url.search = '';
  return url.toString();
}

export async function recreateTestDatabase(): Promise<string | null> {
  const target = testDatabaseUrl();
  if (!target) return null;
  const name = new URL(target).pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(name) || !name.includes('test')) throw new Error(`Base de pruebas con nombre inseguro: ${name}`);
  const client = new pg.Client({ connectionString: adminUrl(target) });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${name}`);
  } finally {
    await client.end();
  }
  const require = createRequire(import.meta.url);
  const prismaCli = require.resolve('prisma/build/index.js');
  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: target },
    encoding: 'utf8',
    timeout: 180_000,
  });
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy falló en ${name}: ${(result.stderr || result.stdout).slice(-2000)}`);
  }
  return target;
}
