-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "tiebreakOrder" TEXT[] DEFAULT ARRAY[]::TEXT[];
