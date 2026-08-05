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
    "gamificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Profile" ("displayName", "focusMode", "gamificationEnabled", "goal", "id", "minutesPerDay", "userId") SELECT "displayName", "focusMode", "gamificationEnabled", "goal", "id", "minutesPerDay", "userId" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
