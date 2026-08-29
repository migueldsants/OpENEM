// Executado em cada worker do Jest ANTES de importar a aplicação.
// Aponta o Prisma para um banco SQLite de teste isolado e define um segredo JWT.
import { join } from 'path';

const testDbPath = join(process.cwd(), 'prisma', 'test-e2e.db');
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.JWT_SECRET = 'e2e-test-secret-comprimento-suficiente';
process.env.JWT_EXPIRES_IN = '1h';
