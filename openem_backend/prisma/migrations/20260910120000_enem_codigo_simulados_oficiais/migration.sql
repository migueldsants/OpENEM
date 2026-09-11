-- Código legível das questões oficiais (ENEM-ANO-QUESTÃO), número no caderno,
-- simulados das provas oficiais do ENEM e remoção do conteúdo de demonstração.
--
-- Os dados (código, número, templates por prova) são preenchidos pelo
-- importador: `npm run db:import:enem` é idempotente e completa as questões
-- já importadas.

-- DropIndex
DROP INDEX "Question_examYearId_idx";

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "code" TEXT;
ALTER TABLE "Question" ADD COLUMN "number" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SimulationTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'FULL',
    "subjectId" TEXT,
    "questionCount" INTEGER NOT NULL DEFAULT 10,
    "timeLimitMin" INTEGER,
    "examYearId" TEXT,
    "day" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SimulationTemplate_examYearId_fkey" FOREIGN KEY ("examYearId") REFERENCES "ExamYear" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SimulationTemplate" ("id", "name", "questionCount", "scope", "subjectId", "timeLimitMin") SELECT "id", "name", "questionCount", "scope", "subjectId", "timeLimitMin" FROM "SimulationTemplate";
DROP TABLE "SimulationTemplate";
ALTER TABLE "new_SimulationTemplate" RENAME TO "SimulationTemplate";
CREATE UNIQUE INDEX "SimulationTemplate_examYearId_day_key" ON "SimulationTemplate"("examYearId", "day");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Question_code_key" ON "Question"("code");

-- CreateIndex
CREATE INDEX "Question_examYearId_number_idx" ON "Question"("examYearId", "number");

-- Simulados de demonstração saem da lista. Arquivados, não apagados: há
-- simulados já feitos ligados a eles, e o histórico do aluno fica.
UPDATE "SimulationTemplate" SET "archived" = true
 WHERE "id" IN ('seed-template-full', 'seed-template-math');

-- Questões de demonstração da seed. Identificadas pelo enunciado exato, e só
-- entre as autorais sem origem externa — nada importado corre risco. Respostas,
-- favoritos e anotações delas saem junto (ON DELETE CASCADE).
DELETE FROM "Question"
 WHERE "source" = 'AUTORAL'
   AND "externalId" IS NULL
   AND "statement" IN (
     'Para f(x) = 2x + 1, qual é o valor de f(2)?',
     'A função f(x) = x² - 4 tem raízes em quais valores de x?',
     'Ao lançar um dado honesto, qual a probabilidade de sair um número par?',
     'Numa urna com 3 bolas vermelhas e 2 azuis, qual a probabilidade de tirar uma azul?',
     'Um carro a 20 m/s percorre quantos metros em 5 segundos (MRU)?',
     'Na queda livre (g = 10 m/s²), qual a velocidade após 3 s partindo do repouso?'
   );
