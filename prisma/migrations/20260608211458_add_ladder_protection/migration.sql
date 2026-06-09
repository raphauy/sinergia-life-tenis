-- CreateEnum
CREATE TYPE "ProtectionReason" AS ENUM ('INJURY', 'TRAVEL', 'OTHER');

-- CreateTable
CREATE TABLE "LadderProtection" (
    "id" TEXT NOT NULL,
    "ladderMemberId" TEXT NOT NULL,
    "reason" "ProtectionReason" NOT NULL,
    "note" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LadderProtection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LadderProtection_ladderMemberId_idx" ON "LadderProtection"("ladderMemberId");

-- CreateIndex
CREATE INDEX "LadderProtection_startDate_idx" ON "LadderProtection"("startDate");

-- CreateIndex
CREATE INDEX "LadderProtection_endDate_idx" ON "LadderProtection"("endDate");

-- AddForeignKey
ALTER TABLE "LadderProtection" ADD CONSTRAINT "LadderProtection_ladderMemberId_fkey" FOREIGN KEY ("ladderMemberId") REFERENCES "LadderMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LadderProtection" ADD CONSTRAINT "LadderProtection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
