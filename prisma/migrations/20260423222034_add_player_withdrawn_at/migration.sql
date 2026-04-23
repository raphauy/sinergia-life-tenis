-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Player_withdrawnAt_idx" ON "Player"("withdrawnAt");
