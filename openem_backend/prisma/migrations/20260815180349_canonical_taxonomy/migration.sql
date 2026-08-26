/*
  Warnings:

  - Added the required column `subjectAreaId` to the `Subject` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "SubjectArea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subjectAreaId" TEXT NOT NULL,
    CONSTRAINT "Subject_subjectAreaId_fkey" FOREIGN KEY ("subjectAreaId") REFERENCES "SubjectArea" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Subject" ("id", "name") SELECT "id", "name" FROM "Subject";
DROP TABLE "Subject";
ALTER TABLE "new_Subject" RENAME TO "Subject";
CREATE UNIQUE INDEX "Subject_name_key" ON "Subject"("name");
CREATE INDEX "Subject_subjectAreaId_idx" ON "Subject"("subjectAreaId");
CREATE TABLE "new_Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 3,
    CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Topic" ("id", "name", "subjectId") SELECT "id", "name", "subjectId" FROM "Topic";
DROP TABLE "Topic";
ALTER TABLE "new_Topic" RENAME TO "Topic";
CREATE UNIQUE INDEX "Topic_subjectId_name_key" ON "Topic"("subjectId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SubjectArea_name_key" ON "SubjectArea"("name");
