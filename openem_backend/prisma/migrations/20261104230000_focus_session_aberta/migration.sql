-- AlterTable
ALTER TABLE "FocusSession" ALTER COLUMN "completedAt" DROP NOT NULL,
ALTER COLUMN "completedAt" DROP DEFAULT;
