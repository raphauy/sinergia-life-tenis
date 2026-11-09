-- CreateEnum
CREATE TYPE "TournamentModality" AS ENUM ('SINGLES', 'DOUBLES');

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "modality" "TournamentModality" NOT NULL DEFAULT 'SINGLES';

-- CreateTable
CREATE TABLE "DoublesPair" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "captainPlayerId" TEXT NOT NULL,
    "partnerPlayerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoublesPair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoublesPair_categoryId_idx" ON "DoublesPair"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "DoublesPair_categoryId_slug_key" ON "DoublesPair"("categoryId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "DoublesPair_captainPlayerId_key" ON "DoublesPair"("captainPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "DoublesPair_partnerPlayerId_key" ON "DoublesPair"("partnerPlayerId");

-- AddForeignKey
ALTER TABLE "DoublesPair" ADD CONSTRAINT "DoublesPair_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TournamentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoublesPair" ADD CONSTRAINT "DoublesPair_captainPlayerId_fkey" FOREIGN KEY ("captainPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoublesPair" ADD CONSTRAINT "DoublesPair_partnerPlayerId_fkey" FOREIGN KEY ("partnerPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
