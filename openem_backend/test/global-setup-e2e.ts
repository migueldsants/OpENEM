import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

// Executado uma vez antes da suíte e2e: cria um banco SQLite de teste limpo
// e aplica as migrations.
export default function globalSetup(): void {
  const testDbPath = join(process.cwd(), 'prisma', 'test-e2e.db');
  const databaseUrl = `file:${testDbPath}`;

  for (const suffix of ['', '-journal']) {
    const file = `${testDbPath}${suffix}`;
    if (existsSync(file)) {
      rmSync(file);
    }
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
