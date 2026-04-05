-- CreateTable
CREATE TABLE "SlotReservation" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "courtNumber" INTEGER NOT NULL DEFAULT 2,
    "reservedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlotReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlotReservation_matchId_key" ON "SlotReservation"("matchId");

-- CreateIndex
CREATE INDEX "SlotReservation_scheduledAt_idx" ON "SlotReservation"("scheduledAt");

-- CreateIndex
CREATE INDEX "SlotReservation_reservedBy_idx" ON "SlotReservation"("reservedBy");

-- AddForeignKey
ALTER TABLE "SlotReservation" ADD CONSTRAINT "SlotReservation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotReservation" ADD CONSTRAINT "SlotReservation_reservedBy_fkey" FOREIGN KEY ("reservedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
