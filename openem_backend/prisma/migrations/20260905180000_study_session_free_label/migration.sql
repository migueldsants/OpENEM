-- Cronograma customizavel (issue #46): o bloco de estudo passa a ser um nome
-- livre ("Matematica", "Ingles", "Revisar simulado") em vez de um Topic
-- obrigatorio. `subjectId` guarda a materia do ENEM quando o nome bate com o
-- catalogo, so para cor e relatorios.
--
-- Backfill: as sessoes existentes viram o nome da MATERIA do topico (nao do
-- subtopico), que e a granularidade que o calendario passa a mostrar.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StudySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "subjectId" TEXT,
    "dayIndex" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StudySession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudySession_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StudySession" ("id", "planId", "label", "subjectId", "dayIndex", "minutes", "done", "position")
SELECT
    s."id",
    s."planId",
    COALESCE(sub."name", 'Estudo'),
    sub."id",
    s."dayIndex",
    s."minutes",
    s."done",
    0
FROM "StudySession" s
LEFT JOIN "Topic" t ON t."id" = s."topicId"
LEFT JOIN "Subject" sub ON sub."id" = t."subjectId";
DROP TABLE "StudySession";
ALTER TABLE "new_StudySession" RENAME TO "StudySession";
CREATE INDEX "StudySession_planId_dayIndex_idx" ON "StudySession"("planId", "dayIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
