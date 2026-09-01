// Runner standalone do seed de fórmulas (issue #38):
//   npx ts-node prisma/seed-formulas.ts
// O catálogo e a lógica vivem em seed-formulas-lib.ts (compartilhados com
// o db:seed principal).
import { PrismaClient } from '@prisma/client';
import { seedFormulas } from './seed-formulas-lib';

const prisma = new PrismaClient();

async function main() {
  const count = await seedFormulas(prisma);
  console.log(`[seed-formulas] ${count} fórmulas garantidas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());