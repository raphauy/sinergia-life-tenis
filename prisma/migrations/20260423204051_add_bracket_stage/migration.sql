-- CreateEnum
CREATE TYPE "MatchStage" AS ENUM ('GROUP', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL');

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_player1Id_fkey";

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_player2Id_fkey";

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "bracketPosition" INTEGER,
ADD COLUMN     "player1SourceGroupId" TEXT,
ADD COLUMN     "player1SourcePosition" INTEGER,
ADD COLUMN     "player2SourceGroupId" TEXT,
ADD COLUMN     "player2SourcePosition" INTEGER,
ADD COLUMN     "stage" "MatchStage" NOT NULL DEFAULT 'GROUP',
ALTER COLUMN "player1Id" DROP NOT NULL,
ALTER COLUMN "player2Id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "finalsDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Match_stage_idx" ON "Match"("stage");

-- CreateIndex
CREATE INDEX "Match_categoryId_stage_idx" ON "Match"("categoryId", "stage");

-- CreateIndex
CREATE INDEX "Match_player1SourceGroupId_idx" ON "Match"("player1SourceGroupId");

-- CreateIndex
CREATE INDEX "Match_player2SourceGroupId_idx" ON "Match"("player2SourceGroupId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player1SourceGroupId_fkey" FOREIGN KEY ("player1SourceGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player2SourceGroupId_fkey" FOREIGN KEY ("player2SourceGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
