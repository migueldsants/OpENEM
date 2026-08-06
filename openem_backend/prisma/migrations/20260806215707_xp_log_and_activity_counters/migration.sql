-- CreateTable
CREATE TABLE "XpLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "xpGained" INTEGER NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "XpLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GamificationStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActivityOn" DATETIME,
    "answersCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "simulationsCount" INTEGER NOT NULL DEFAULT 0,
    "essaysCount" INTEGER NOT NULL DEFAULT 0,
    "highScoreEssays" INTEGER NOT NULL DEFAULT 0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "sessionsDone" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GamificationStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GamificationStat" ("answersCount", "correctCount", "currentStreak", "id", "lastActivityOn", "longestStreak", "points", "updatedAt", "userId") SELECT "answersCount", "correctCount", "currentStreak", "id", "lastActivityOn", "longestStreak", "points", "updatedAt", "userId" FROM "GamificationStat";
DROP TABLE "GamificationStat";
ALTER TABLE "new_GamificationStat" RENAME TO "GamificationStat";
CREATE UNIQUE INDEX "GamificationStat_userId_key" ON "GamificationStat"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "XpLog_userId_createdAt_idx" ON "XpLog"("userId", "createdAt");
