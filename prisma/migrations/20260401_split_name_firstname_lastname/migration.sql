-- Step 1: Add new columns
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

ALTER TABLE "AdminInvitation" ADD COLUMN "firstName" TEXT;
ALTER TABLE "AdminInvitation" ADD COLUMN "lastName" TEXT;

ALTER TABLE "Player" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Player" ADD COLUMN "lastName" TEXT;

ALTER TABLE "ImportedPlayer" ADD COLUMN "firstName" TEXT;
ALTER TABLE "ImportedPlayer" ADD COLUMN "lastName" TEXT;

-- Step 2: Migrate existing data
UPDATE "User" SET
  "firstName" = split_part("name", ' ', 1),
  "lastName" = CASE WHEN position(' ' in "name") > 0
    THEN substring("name" from position(' ' in "name") + 1) ELSE NULL END
WHERE "name" IS NOT NULL;

UPDATE "Player" SET
  "firstName" = split_part("name", ' ', 1),
  "lastName" = CASE WHEN position(' ' in "name") > 0
    THEN substring("name" from position(' ' in "name") + 1) ELSE '' END;

UPDATE "ImportedPlayer" SET
  "firstName" = split_part("name", ' ', 1),
  "lastName" = CASE WHEN position(' ' in "name") > 0
    THEN substring("name" from position(' ' in "name") + 1) ELSE '' END;

UPDATE "AdminInvitation" SET
  "firstName" = split_part("name", ' ', 1),
  "lastName" = CASE WHEN position(' ' in "name") > 0
    THEN substring("name" from position(' ' in "name") + 1) ELSE NULL END
WHERE "name" IS NOT NULL;

-- Step 3: Make required columns NOT NULL
ALTER TABLE "Player" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "Player" ALTER COLUMN "lastName" SET NOT NULL;
ALTER TABLE "ImportedPlayer" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "ImportedPlayer" ALTER COLUMN "lastName" SET NOT NULL;

-- Step 4: Drop old name columns
ALTER TABLE "User" DROP COLUMN "name";
ALTER TABLE "AdminInvitation" DROP COLUMN "name";
ALTER TABLE "Player" DROP COLUMN "name";
ALTER TABLE "ImportedPlayer" DROP COLUMN "name";
