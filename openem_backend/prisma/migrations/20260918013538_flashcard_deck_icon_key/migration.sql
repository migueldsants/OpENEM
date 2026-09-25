-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FlashcardDeck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "subject" TEXT NOT NULL,
    "topic" TEXT,
    "subtheme" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 3,
    "icon" TEXT NOT NULL DEFAULT 'books',
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlashcardDeck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FlashcardDeck" ("createdAt", "description", "downvotes", "icon", "id", "isPublic", "subject", "subtheme", "title", "topic", "upvotes", "userId", "weight") SELECT "createdAt", "description", "downvotes", "icon", "id", "isPublic", "subject", "subtheme", "title", "topic", "upvotes", "userId", "weight" FROM "FlashcardDeck";
DROP TABLE "FlashcardDeck";
ALTER TABLE "new_FlashcardDeck" RENAME TO "FlashcardDeck";
CREATE INDEX "FlashcardDeck_isPublic_upvotes_idx" ON "FlashcardDeck"("isPublic", "upvotes");
CREATE INDEX "FlashcardDeck_subject_idx" ON "FlashcardDeck"("subject");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
