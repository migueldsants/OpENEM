import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { E2E_SCHEMA } from '../src/common/test-database';
import { e2eDatabaseUrlFromEnv } from './e2e-database';

// Executado uma vez antes da suíte e2e: recria do zero o schema de teste no
// Postgres e aplica as migrations. Apaga só o schema `test_e2e` (o nome é
// fixo, nunca vem do ambiente), então os dados de dev no `public` ficam
// intactos — é o equivalente ao antigo "apagar o arquivo test-e2e.db".
export default async function globalSetup(): Promise<void> {
  const databaseUrl = e2eDatabaseUrlFromEnv();
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    await prisma.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${E2E_SCHEMA}" CASCADE`,
    );
  } finally {
    await prisma.$disconnect();
  }

  const env = { ...process.env, DATABASE_URL: databaseUrl };
  execSync('npx prisma migrate deploy', { env, stdio: 'inherit' });
  // Popula o banco de teste com o seed, incluindo o conteúdo de demonstração
  // (questões e simulados) de que as suítes dependem — fora dos testes ele
  // não é criado.
  execSync('npx prisma db seed', {
    env: { ...env, SEED_DEMO: '1' },
    stdio: 'inherit',
  });
}
