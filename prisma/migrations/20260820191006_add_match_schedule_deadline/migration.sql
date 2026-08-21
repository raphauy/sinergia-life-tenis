-- Plazo explícito para concretar un partido de escalera. Reemplaza el cálculo sobre
-- `createdAt` del cron: ese reloj no se pausaba mientras la reserva esperaba al admin,
-- así que al borrarse la reserva el partido moría en la corrida siguiente, sin aviso.
ALTER TABLE "Match" ADD COLUMN "scheduleDeadlineAt" TIMESTAMP(3);
ALTER TABLE "Match" ADD COLUMN "scheduleWarnedAt"   TIMESTAMP(3);

-- El plazo pasa de 3 a 5 días: reservar exige +2 días de anticipación mínima y sólo
-- en los días alternantes habilitados, así que con 3 la ventana real para pedir slot
-- era más corta que el plazo.
ALTER TABLE "Ladder" ALTER COLUMN "matchScheduleDeadlineDays" SET DEFAULT 5;
UPDATE "Ladder" SET "matchScheduleDeadlineDays" = 5 WHERE "matchScheduleDeadlineDays" = 3;

-- Backfill: todo partido de escalera vivo arranca con plazo nuevo desde hoy (los que
-- tienen reserva pendiente incluidos). scheduleDeadlineAt NULL = no vence: los de
-- torneo y cualquier legacy quedan fuera del cron, que es el lado seguro del error.
UPDATE "Match" SET "scheduleDeadlineAt" = now() + interval '5 days'
WHERE "ladderId" IS NOT NULL AND "status" = 'PENDING';
