-- CreateTable
CREATE TABLE "UserTheme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "light" TEXT NOT NULL,
    "dark" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserTheme_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserThemeLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "themeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserThemeLike_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "UserTheme" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserThemeLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserTheme_isPublic_likes_idx" ON "UserTheme"("isPublic", "likes");

-- CreateIndex
CREATE INDEX "UserTheme_isPublic_publishedAt_idx" ON "UserTheme"("isPublic", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserTheme_ownerId_name_key" ON "UserTheme"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UserThemeLike_themeId_userId_key" ON "UserThemeLike"("themeId", "userId");

