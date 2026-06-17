-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ReviewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "easeFactor" REAL NOT NULL DEFAULT 2.5,
    "intervalD" INTEGER NOT NULL DEFAULT 0,
    "repetition" INTEGER NOT NULL DEFAULT 0,
    "dueAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReviewItem" ("dueAt", "easeFactor", "id", "intervalD", "repetition", "topicId", "userId") SELECT "dueAt", "easeFactor", "id", "intervalD", "repetition", "topicId", "userId" FROM "ReviewItem";
DROP TABLE "ReviewItem";
ALTER TABLE "new_ReviewItem" RENAME TO "ReviewItem";
CREATE UNIQUE INDEX "ReviewItem_userId_topicId_key" ON "ReviewItem"("userId", "topicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
