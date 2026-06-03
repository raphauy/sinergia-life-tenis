-- Columna requerida nueva. Las solicitudes preexistentes (datos de prueba) quedan
-- con cédula vacía; el DEFAULT temporal evita que el ADD COLUMN falle, y se quita
-- enseguida para que las nuevas filas deban traer cédula desde la app.
-- AlterTable
ALTER TABLE "PlayerRegistration" ADD COLUMN "cedula" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlayerRegistration" ALTER COLUMN "cedula" DROP DEFAULT;
