-- Anticipación de reserva por defecto: 30 → 7 días.
ALTER TABLE "Ladder" ALTER COLUMN "reservationLeadDays" SET DEFAULT 7;

-- Actualizar la escalera ya creada que conserva el viejo default (no toca valores custom).
UPDATE "Ladder" SET "reservationLeadDays" = 7 WHERE "reservationLeadDays" = 30;
