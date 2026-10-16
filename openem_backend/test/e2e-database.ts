import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parseEnv } from 'util';
import { e2eDatabaseUrl } from '../src/common/test-database';

/**
 * URL do banco da suíte e2e. A base vem de `E2E_DATABASE_URL`, senão de
 * `DATABASE_URL` (ambiente ou `.env`), e o schema é sempre o da suíte — o Jest
 * não lê o `.env` sozinho, por isso a leitura aqui.
 */
export function e2eDatabaseUrlFromEnv(): string {
  const envFile = join(process.cwd(), '.env');
  const fromFile = existsSync(envFile)
    ? parseEnv(readFileSync(envFile, 'utf8')).DATABASE_URL
    : undefined;
  const base =
    process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? fromFile;
  if (!base) {
    throw new Error(
      'defina DATABASE_URL (ou E2E_DATABASE_URL) apontando para um Postgres — ex.: `docker compose up -d db`',
    );
  }
  return e2eDatabaseUrl(base);
}
