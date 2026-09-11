-- Banco oficial do ENEM: campos de origem/idioma/área na questão, letra e ordem
-- nas alternativas, e a prova (ExamYear) identificada por slug em vez de ano —
-- a reaplicação de 2023 também é ano 2023.
--
-- Escrita à mão a partir de `prisma migrate diff` porque o SQL gerado não faz os
-- backfills derivados (slug/label da prova, área da questão, ordem/letra das
-- alternativas) e falharia nas colunas NOT NULL novas de ExamYear.
--
-- Mudança de risco: Question.topicId passa de ON DELETE CASCADE para SET NULL.
-- Com Cascade, o `subjectArea.deleteMany` do seed apagaria todo o banco de
-- questões ao menor ajuste na TAXONOMY.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Alternative: letra e posição. A posição preserva a ordem de inserção atual
-- (rowid), que é exatamente a que a UI já exibe via LETTERS[i].
CREATE TABLE "new_Alternative" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "letter" TEXT,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Alternative_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Alternative" ("id", "questionId", "letter", "text", "imageUrl", "isCorrect", "position")
SELECT a."id",
       a."questionId",
       substr('ABCDEFGH',
              (SELECT COUNT(*) FROM "Alternative" a2
                WHERE a2."questionId" = a."questionId" AND a2.rowid < a.rowid) + 1, 1),
       a."text",
       NULL,
       a."isCorrect",
       (SELECT COUNT(*) FROM "Alternative" a2
         WHERE a2."questionId" = a."questionId" AND a2.rowid < a.rowid)
  FROM "Alternative" a;
DROP TABLE "Alternative";
ALTER TABLE "new_Alternative" RENAME TO "Alternative";
CREATE INDEX "Alternative_questionId_position_idx" ON "Alternative"("questionId", "position");

-- ExamYear: o slug da prova regular é o próprio ano, de modo que o ExamYear 2023
-- já semeado seja adotado pelo importador em vez de duplicado.
CREATE TABLE "new_ExamYear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isReapplication" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_ExamYear" ("id", "slug", "year", "label", "isReapplication")
SELECT "id", CAST("year" AS TEXT), "year", 'ENEM ' || CAST("year" AS TEXT), false FROM "ExamYear";
DROP TABLE "ExamYear";
ALTER TABLE "new_ExamYear" RENAME TO "ExamYear";
CREATE UNIQUE INDEX "ExamYear_slug_key" ON "ExamYear"("slug");
CREATE INDEX "ExamYear_year_idx" ON "ExamYear"("year");

-- Profile: língua estrangeira da prova (o banco guarda inglês e espanhol da
-- mesma questão; sem esse filtro o aluno vê tudo em dobro).
CREATE TABLE "new_Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "goal" TEXT NOT NULL DEFAULT 'SISU',
    "minutesPerDay" INTEGER NOT NULL DEFAULT 60,
    "displayName" TEXT,
    "focusMode" BOOLEAN NOT NULL DEFAULT false,
    "gamificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "foreignLanguage" TEXT NOT NULL DEFAULT 'ingles',
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Profile" ("displayName", "focusMode", "gamificationEnabled", "goal", "id", "minutesPerDay", "onboarded", "userId")
SELECT "displayName", "focusMode", "gamificationEnabled", "goal", "id", "minutesPerDay", "onboarded", "userId" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- Question: origem externa, idioma, comando separado do apoio, área do
-- conhecimento e tópico opcional. subjectAreaId é derivado de Topic -> Subject.
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'AUTORAL',
    "statement" TEXT NOT NULL,
    "questionPrompt" TEXT,
    "language" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 3,
    "explanation" TEXT,
    "explanationSource" TEXT,
    "subjectAreaId" TEXT,
    "topicId" TEXT,
    "examYearId" TEXT,
    "discrimination" REAL,
    "irtDifficulty" REAL,
    "guessing" REAL,
    "classificationConfidence" REAL,
    "classificationAttempts" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Question_subjectAreaId_fkey" FOREIGN KEY ("subjectAreaId") REFERENCES "SubjectArea" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_examYearId_fkey" FOREIGN KEY ("examYearId") REFERENCES "ExamYear" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("id", "externalId", "source", "statement", "questionPrompt", "language",
                            "difficulty", "explanation", "explanationSource", "subjectAreaId",
                            "topicId", "examYearId", "discrimination", "irtDifficulty", "guessing",
                            "classificationConfidence", "classificationAttempts")
SELECT q."id",
       NULL,
       'AUTORAL',
       q."statement",
       NULL,
       NULL,
       q."difficulty",
       q."explanation",
       CASE WHEN q."explanation" IS NOT NULL AND q."explanation" <> '' THEN 'seed' ELSE NULL END,
       s."subjectAreaId",
       q."topicId",
       q."examYearId",
       q."discrimination",
       q."irtDifficulty",
       q."guessing",
       NULL,
       0
  FROM "Question" q
  LEFT JOIN "Topic" t ON t."id" = q."topicId"
  LEFT JOIN "Subject" s ON s."id" = t."subjectId";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE UNIQUE INDEX "Question_externalId_key" ON "Question"("externalId");
CREATE INDEX "Question_topicId_difficulty_idx" ON "Question"("topicId", "difficulty");
CREATE INDEX "Question_subjectAreaId_difficulty_idx" ON "Question"("subjectAreaId", "difficulty");
CREATE INDEX "Question_subjectAreaId_topicId_idx" ON "Question"("subjectAreaId", "topicId");
CREATE INDEX "Question_examYearId_idx" ON "Question"("examYearId");
CREATE INDEX "Question_language_idx" ON "Question"("language");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
