-- CreateEnum
CREATE TYPE "Cup" AS ENUM ('GOLD', 'SILVER');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "cup" "Cup";
