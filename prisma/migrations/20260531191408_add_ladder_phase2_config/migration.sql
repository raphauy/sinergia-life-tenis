-- AlterTable
ALTER TABLE "Ladder" ADD COLUMN     "matchFormat" "MatchFormat" NOT NULL DEFAULT 'SINGLE_SET',
ADD COLUMN     "matchScheduleDeadlineDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "rematchCooldownDays" INTEGER NOT NULL DEFAULT 3;
