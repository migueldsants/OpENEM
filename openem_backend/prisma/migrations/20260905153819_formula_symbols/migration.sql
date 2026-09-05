-- CreateTable
CREATE TABLE "FormulaSymbol" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formulaId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "unit" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FormulaSymbol_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "Formula" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FormulaSymbol_formulaId_idx" ON "FormulaSymbol"("formulaId");
