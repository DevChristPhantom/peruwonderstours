// Prisma 7: la URL de conexión ya no va en schema.prisma sino aquí.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Sin tsx instalado se usa el seed compilado (requiere `pnpm build`). Con tsx: 'tsx prisma/seed.ts'.
    seed: 'node dist/database/seed/run-seed.js',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
