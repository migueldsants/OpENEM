// Executado em cada worker do Jest ANTES de importar a aplicação.
// Aponta o Prisma para o schema de teste isolado no Postgres e define um
// segredo JWT.
import { e2eDatabaseUrlFromEnv } from './e2e-database';

process.env.DATABASE_URL = e2eDatabaseUrlFromEnv();
process.env.JWT_SECRET = 'e2e-test-secret-comprimento-suficiente';
process.env.JWT_EXPIRES_IN = '1h';
