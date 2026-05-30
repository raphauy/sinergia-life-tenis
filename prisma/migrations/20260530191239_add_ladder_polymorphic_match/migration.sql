-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RatingChangeReason" AS ENUM ('SEED', 'MATCH', 'PENALTY', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "challengeId" TEXT,
ADD COLUMN     "ladderId" TEXT,
ALTER COLUMN "tournamentId" DROP NOT NULL,
ALTER COLUMN "categoryId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Ladder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "kFactor" INTEGER NOT NULL DEFAULT 24,
    "seedBaseRating" INTEGER NOT NULL DEFAULT 1500,
    "seedStep" INTEGER NOT NULL DEFAULT 20,
    "minMatchesPerMonth" INTEGER NOT NULL DEFAULT 2,
    "monthlyPenalty" INTEGER NOT NULL DEFAULT 50,
    "maxChallengesPerMonth" INTEGER NOT NULL DEFAULT 4,
    "maxOpenChallenges" INTEGER NOT NULL DEFAULT 2,
    "acceptanceWindowDays" INTEGER NOT NULL DEFAULT 4,
    "reservationLeadDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ladder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LadderMember" (
    "id" TEXT NOT NULL,
    "ladderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priorityEligible" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LadderMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "ladderId" TEXT NOT NULL,
    "challengerId" TEXT NOT NULL,
    "challengedId" TEXT NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'PROPOSED',
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondByAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "matchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingHistory" (
    "id" TEXT NOT NULL,
    "ladderMemberId" TEXT NOT NULL,
    "reason" "RatingChangeReason" NOT NULL,
    "matchId" TEXT,
    "ratingBefore" INTEGER NOT NULL,
    "ratingAfter" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LadderPeriodClose" (
    "id" TEXT NOT NULL,
    "ladderId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LadderPeriodClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ladder_slug_key" ON "Ladder"("slug");

-- CreateIndex
CREATE INDEX "Ladder_slug_idx" ON "Ladder"("slug");

-- CreateIndex
CREATE INDEX "Ladder_isActive_idx" ON "Ladder"("isActive");

-- CreateIndex
CREATE INDEX "LadderMember_ladderId_idx" ON "LadderMember"("ladderId");

-- CreateIndex
CREATE INDEX "LadderMember_userId_idx" ON "LadderMember"("userId");

-- CreateIndex
CREATE INDEX "LadderMember_rating_idx" ON "LadderMember"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "LadderMember_ladderId_userId_key" ON "LadderMember"("ladderId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_matchId_key" ON "Challenge"("matchId");

-- CreateIndex
CREATE INDEX "Challenge_ladderId_idx" ON "Challenge"("ladderId");

-- CreateIndex
CREATE INDEX "Challenge_challengerId_idx" ON "Challenge"("challengerId");

-- CreateIndex
CREATE INDEX "Challenge_challengedId_idx" ON "Challenge"("challengedId");

-- CreateIndex
CREATE INDEX "Challenge_status_idx" ON "Challenge"("status");

-- CreateIndex
CREATE INDEX "RatingHistory_ladderMemberId_idx" ON "RatingHistory"("ladderMemberId");

-- CreateIndex
CREATE INDEX "RatingHistory_matchId_idx" ON "RatingHistory"("matchId");

-- CreateIndex
CREATE INDEX "RatingHistory_createdAt_idx" ON "RatingHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LadderPeriodClose_ladderId_year_month_key" ON "LadderPeriodClose"("ladderId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Match_challengeId_key" ON "Match"("challengeId");

-- CreateIndex
CREATE INDEX "Match_ladderId_idx" ON "Match"("ladderId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_ladderId_fkey" FOREIGN KEY ("ladderId") REFERENCES "Ladder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LadderMember" ADD CONSTRAINT "LadderMember_ladderId_fkey" FOREIGN KEY ("ladderId") REFERENCES "Ladder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LadderMember" ADD CONSTRAINT "LadderMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_ladderId_fkey" FOREIGN KEY ("ladderId") REFERENCES "Ladder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_challengedId_fkey" FOREIGN KEY ("challengedId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingHistory" ADD CONSTRAINT "RatingHistory_ladderMemberId_fkey" FOREIGN KEY ("ladderMemberId") REFERENCES "LadderMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingHistory" ADD CONSTRAINT "RatingHistory_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LadderPeriodClose" ADD CONSTRAINT "LadderPeriodClose_ladderId_fkey" FOREIGN KEY ("ladderId") REFERENCES "Ladder"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Invariante polimórfica (ADR 0001): un partido es de torneo XOR de escalera.
ALTER TABLE "Match" ADD CONSTRAINT "match_tournament_xor_ladder" CHECK (
  ("tournamentId" IS NOT NULL AND "categoryId" IS NOT NULL AND "ladderId" IS NULL)
  OR ("ladderId" IS NOT NULL AND "tournamentId" IS NULL AND "categoryId" IS NULL)
);
