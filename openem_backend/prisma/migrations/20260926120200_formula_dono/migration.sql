-- Fórmula ganha dono (ownerId) e o título passa a ser único por dono, não no
-- banco todo. Personalizadas criadas antes disso não têm dono conhecido e
-- ficam ocultas (isBuiltIn = false, ownerId nulo): antes, apareciam para
-- todos os alunos.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Formula" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "latex" TEXT NOT NULL,
    "description" TEXT,
    "subjectId" TEXT NOT NULL,
    "topicId" TEXT,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Formula_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Formula_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Formula_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Formula" ("createdAt", "description", "id", "isBuiltIn", "latex", "subjectId", "title", "topicId") SELECT "createdAt", "description", "id", "isBuiltIn", "latex", "subjectId", "title", "topicId" FROM "Formula";
DROP TABLE "Formula";
ALTER TABLE "new_Formula" RENAME TO "Formula";
CREATE INDEX "Formula_subjectId_idx" ON "Formula"("subjectId");
CREATE INDEX "Formula_title_idx" ON "Formula"("title");
CREATE UNIQUE INDEX "Formula_ownerId_title_key" ON "Formula"("ownerId", "title");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

