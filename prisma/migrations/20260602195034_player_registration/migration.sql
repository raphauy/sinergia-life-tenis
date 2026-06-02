-- CreateEnum
CREATE TYPE "PlayerRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PlayerRegistration" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "status" "PlayerRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerRegistration_email_idx" ON "PlayerRegistration"("email");

-- CreateIndex
CREATE INDEX "PlayerRegistration_status_idx" ON "PlayerRegistration"("status");

-- CreateIndex
CREATE INDEX "PlayerRegistration_createdAt_idx" ON "PlayerRegistration"("createdAt");

-- AddForeignKey
ALTER TABLE "PlayerRegistration" ADD CONSTRAINT "PlayerRegistration_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
