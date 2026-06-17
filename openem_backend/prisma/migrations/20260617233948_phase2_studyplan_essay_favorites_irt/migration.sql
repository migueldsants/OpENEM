-- AlterTable
ALTER TABLE "Question" ADD COLUMN "discrimination" REAL;
ALTER TABLE "Question" ADD COLUMN "guessing" REAL;
ALTER TABLE "Question" ADD COLUMN "irtDifficulty" REAL;

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Favorite_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "minutesPerDay" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "StudySession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudySession_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EssayPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "year" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EssaySubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EssaySubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EssaySubmission_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "EssayPrompt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EssayEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "c1" INTEGER NOT NULL,
    "c2" INTEGER NOT NULL,
    "c3" INTEGER NOT NULL,
    "c4" INTEGER NOT NULL,
    "c5" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "feedback" TEXT,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EssayEvaluation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "EssaySubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "goal" TEXT NOT NULL DEFAULT 'SISU',
    "minutesPerDay" INTEGER NOT NULL DEFAULT 60,
    "displayName" TEXT,
    "focusMode" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Profile" ("displayName", "goal", "id", "minutesPerDay", "userId") SELECT "displayName", "goal", "id", "minutesPerDay", "userId" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_questionId_key" ON "Favorite"("userId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPlan_userId_key" ON "StudyPlan"("userId");

-- CreateIndex
CREATE INDEX "StudySession_planId_dayIndex_idx" ON "StudySession"("planId", "dayIndex");

-- CreateIndex
CREATE UNIQUE INDEX "EssayEvaluation_submissionId_key" ON "EssayEvaluation"("submissionId");
