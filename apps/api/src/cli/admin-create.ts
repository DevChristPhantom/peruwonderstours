/**
 * `pnpm admin:create -- --email admin@empresa.pe --name "Nombre Apellido" [--generate] [--allow-additional]`
 *
 * Crea el PRIMER administrador del backoffice en PostgreSQL (DATABASE_URL de .env).
 *  - Sin --generate: pide la contraseña por stdin (oculta si es una terminal; si llega por tubería
 *    se lee la primera línea) y la confirma.
 *  - Con --generate: genera una contraseña aleatoria y la imprime UNA sola vez por stdout.
 * Nunca escribe la contraseña en archivos ni en logs. El MFA TOTP se enrola en el primer ingreso.
 * Si ya existe un admin activo, se niega salvo --allow-additional.
 */
import { config } from 'dotenv';
import { parseArgs } from 'node:util';
import { StaffUsersUseCases } from '../modules/identity/application/staff-users.use-cases.js';
import { PrismaIdentityStore } from '../modules/identity/infrastructure/identity-stores.js';
import { Argon2PasswordHasher } from '../modules/identity/infrastructure/security-adapters.js';
import { createPrismaClient } from '../persistence/prisma/prisma-client.js';
import { DomainError } from '../shared/domain/domain-error.js';
import { SystemClock, UuidV7Generator } from '../shared/infrastructure/system.js';

function fail(message: string): never {
  process.stderr.write(`admin:create: ${message}\n`);
  process.exit(1);
}

config({ quiet: true });

/** Primera línea de stdin cuando llega por tubería (p. ej. desde un gestor de secretos). */
async function readPipedLine(): Promise<string> {
  let data = '';
  for await (const chunk of process.stdin) data += String(chunk);
  return data.split('\n')[0]?.replace(/\r$/, '') ?? '';
}

/** Lee una línea sin eco en una terminal. */
function readSecret(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const input = process.stdin;
    process.stderr.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');
    let value = '';
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          input.setRawMode(false);
          input.pause();
          input.off('data', onData);
          process.stderr.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          input.setRawMode(false);
          process.stderr.write('\n');
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    input.on('data', onData);
  });
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    // pnpm reenvía el separador "--" literal: se descarta.
    args: process.argv.slice(2).filter((a) => a !== '--'),
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      generate: { type: 'boolean', default: false },
      'allow-additional': { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });
  if (!values.email || !values.name) fail('uso: pnpm admin:create -- --email <correo> --name "<nombre>" [--generate]');
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) fail('falta DATABASE_URL (apps/api/.env).');

  // La contraseña por tubería se lee antes de abrir la base (stdin puede cerrarse pronto).
  let password: string | undefined = !values.generate && !process.stdin.isTTY ? await readPipedLine() : undefined;
  const prisma = createPrismaClient(databaseUrl);
  try {
    await prisma.$connect();
    const admins = await prisma.user.count({ where: { role: 'admin', status: 'active', deletedAt: null } });
    if (admins > 0 && !values['allow-additional']) {
      fail(`ya existe ${admins} administrador(es) activo(s). Crea más usuarios desde el backoffice o usa --allow-additional.`);
    }

    if (!values.generate) {
      if (process.stdin.isTTY) {
        password = await readSecret('Contraseña (mín. 12 caracteres): ');
        const again = await readSecret('Repite la contraseña: ');
        if (again !== password) fail('las contraseñas no coinciden.');
      }
      if (!password) fail('contraseña vacía (o usa --generate).');
    }

    const users = new StaffUsersUseCases(new PrismaIdentityStore(prisma), new SystemClock(), new UuidV7Generator(), new Argon2PasswordHasher());
    const result = await users.create({ email: values.email, fullName: values.name, role: 'admin', password }, null, { ip: null, userAgent: 'cli:admin-create', requestId: null });
    process.stderr.write(`Administrador creado: ${result.user.email} (id ${result.user.id}). Debe enrolar MFA (TOTP) en su primer ingreso.\n`);
    if (result.temporaryPassword) {
      process.stderr.write('Contraseña generada (se muestra UNA sola vez; guárdala en un gestor de contraseñas):\n');
      process.stdout.write(`${result.temporaryPassword}\n`);
    }
  } catch (error) {
    if (error instanceof DomainError) {
      const errors = (error.details['errors'] as Array<{ messages: string[] }> | undefined)?.flatMap((e) => e.messages) ?? [];
      fail([error.message, ...errors].join(' '));
    }
    fail(error instanceof Error ? error.message : String(error));
  } finally {
    await prisma.$disconnect();
  }
}

await main();
