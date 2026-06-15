-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "rankGapAtReject" INTEGER;

-- AlterTable
ALTER TABLE "Ladder" ADD COLUMN     "gallinaPositionRange" INTEGER NOT NULL DEFAULT 10;
