-- La Escalera Fase 3: la multa es solo puntos; la reserva no se gatea por actividad.
-- priorityEligible quedó sin uso → se elimina.
ALTER TABLE "LadderMember" DROP COLUMN "priorityEligible";

-- Piso de rating (la multa no baja por debajo) y días de aviso pre-cierre.
ALTER TABLE "Ladder" ADD COLUMN "ratingFloor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Ladder" ADD COLUMN "monthlyWarningLeadDays" INTEGER NOT NULL DEFAULT 3;
