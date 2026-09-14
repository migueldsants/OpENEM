-- AlterTable
ALTER TABLE "Question" ADD COLUMN "classificationSource" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SimulationTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'FULL',
    "subjectId" TEXT,
    "subjectAreaId" TEXT,
    "questionCount" INTEGER NOT NULL DEFAULT 10,
    "timeLimitMin" INTEGER,
    "ownerId" TEXT,
    "filters" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "examYearId" TEXT,
    "day" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SimulationTemplate_subjectAreaId_fkey" FOREIGN KEY ("subjectAreaId") REFERENCES "SubjectArea" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SimulationTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SimulationTemplate_examYearId_fkey" FOREIGN KEY ("examYearId") REFERENCES "ExamYear" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SimulationTemplate" ("archived", "day", "examYearId", "id", "name", "questionCount", "scope", "subjectId", "timeLimitMin") SELECT "archived", "day", "examYearId", "id", "name", "questionCount", "scope", "subjectId", "timeLimitMin" FROM "SimulationTemplate";
DROP TABLE "SimulationTemplate";
ALTER TABLE "new_SimulationTemplate" RENAME TO "SimulationTemplate";
CREATE UNIQUE INDEX "SimulationTemplate_examYearId_day_key" ON "SimulationTemplate"("examYearId", "day");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
