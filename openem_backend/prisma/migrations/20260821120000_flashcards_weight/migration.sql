-- AlterTable
ALTER TABLE "FlashcardDeck" ADD COLUMN "subtheme" TEXT;
ALTER TABLE "FlashcardDeck" ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 3;
