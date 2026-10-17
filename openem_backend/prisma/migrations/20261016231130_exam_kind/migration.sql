-- AlterTable
ALTER TABLE "ExamYear" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'REGULAR';

-- As reaplicações já importadas ganham o tipo sem esperar um novo import.
UPDATE "ExamYear" SET "kind" = 'REAPLICACAO' WHERE "isReapplication" = true;
