import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createPrismaClient } from '../../apps/api/dist/persistence/prisma/prisma-client.js';
import { AesGcmPiiCipher } from '../../apps/api/dist/shared/infrastructure/aes-gcm-pii-cipher.js';
import { Argon2PasswordHasher } from '../../apps/api/dist/modules/identity/infrastructure/security-adapters.js';
import { HeroBannersService } from '../../apps/api/dist/modules/hero-banners/application/hero-banners.service.js';

// Deliberately refuses desktop databases and production. This fixture is only for
// the fresh PostgreSQL service owned by the browser-checks workflow.
const url = new URL(process.env.DATABASE_URL ?? '');
if (process.env.CI !== 'true' || process.env.NODE_ENV !== 'test' || !['localhost', '127.0.0.1'].includes(url.hostname)
  || url.pathname !== '/pwt_browser_test') throw new Error('Staff fixture requires the isolated CI pwt_browser_test database.');
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const secret = process.env.E2E_ADMIN_TOTP_SECRET;
const piiKey = process.env.PII_ENCRYPTION_KEY;
if (!email || !password || !secret || !piiKey) throw new Error('Missing browser fixture configuration.');
if (process.env.MEDIA_LOCAL_DIR !== '/tmp/pwt-browser-media') throw new Error('Hero fixture requires isolated /tmp/pwt-browser-media storage.');
const banners = new HeroBannersService(process.env.MEDIA_LOCAL_DIR);
if ((await banners.list()).length !== 0) throw new Error('Hero fixture requires empty isolated banner storage.');
const prisma = createPrismaClient(url.toString());
try {
  if (await prisma.user.count() !== 0) throw new Error('Staff fixture requires an empty users table; no existing accounts are changed.');
  const id = randomUUID();
  const cipher = AesGcmPiiCipher.fromBase64(piiKey);
  await prisma.user.create({ data: {
    id, email, fullName: 'Browser CI Administrator', role: 'admin', status: 'active',
    passwordHash: await new Argon2PasswordHasher().hash(password),
    mfaSecretEnc: Buffer.from(cipher.encrypt(secret, `users:mfa_secret_enc:${id}`)),
    mfaEnabledAt: new Date(), mustChangePassword: false,
  } });
  const scenes = [
    { file: 'titicaca-0.webp', title: 'Lago Titicaca', effect: 'water', titleEmbedded: false },
    { file: 'machu-picchu-0.webp', title: 'Machu Picchu', effect: 'clouds', titleEmbedded: true },
  ];
  for (const [sortOrder, scene] of scenes.entries()) {
    const image = await readFile(new URL(`../../apps/web/public/hero-motion/${scene.file}`, import.meta.url));
    const record = await banners.upload(image, scene.file, scene.title, scene.effect, scene.titleEmbedded);
    await banners.patch(record.id, { revision: record.revision, enabled: true, sortOrder });
  }
  console.log('Isolated browser fixtures created: staff MFA and two active native hero scenes.');
} finally { await prisma.$disconnect(); }
