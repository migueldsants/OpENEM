-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "goal" TEXT NOT NULL DEFAULT 'SISU',
    "minutesPerDay" INTEGER NOT NULL DEFAULT 60,
    "displayName" TEXT,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamYear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statement" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 3,
    "explanation" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "examYearId" TEXT,
    CONSTRAINT "Question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Question_examYearId_fkey" FOREIGN KEY ("examYearId") REFERENCES "ExamYear" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alternative" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Alternative_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SimulationTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'FULL',
    "subjectId" TEXT,
    "timeLimitMin" INTEGER
);

-- CreateTable
CREATE TABLE "Simulation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "rawScore" REAL,
    "triScore" REAL,
    CONSTRAINT "Simulation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Simulation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SimulationTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "chosenId" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "timeSpentSec" INTEGER,
    "simulationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Answer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Answer_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "easeFactor" REAL NOT NULL DEFAULT 2.5,
    "intervalD" INTEGER NOT NULL DEFAULT 0,
    "dueAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_name_key" ON "Subject"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_subjectId_name_key" ON "Topic"("subjectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ExamYear_year_key" ON "ExamYear"("year");

-- CreateIndex
CREATE INDEX "Question_topicId_difficulty_idx" ON "Question"("topicId", "difficulty");

-- CreateIndex
CREATE INDEX "Answer_userId_questionId_idx" ON "Answer"("userId", "questionId");
