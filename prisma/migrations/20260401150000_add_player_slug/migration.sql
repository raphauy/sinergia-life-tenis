-- AlterTable: add slug as nullable first
ALTER TABLE "Player" ADD COLUMN "slug" TEXT;

-- Backfill: generate slugs from firstName + lastName
UPDATE "Player" SET "slug" = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRANSLATE(
          LOWER(CONCAT("firstName", ' ', "lastName")),
          'áàâãäéèêëíìîïóòôõöúùûüñ',
          'aaaaaeeeeiiiioooooruuuun'
        ),
        '[^a-z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  )
);

-- Handle any NULLs or empty slugs
UPDATE "Player" SET "slug" = 'jugador-' || SUBSTRING("id" FROM 1 FOR 8) WHERE "slug" IS NULL OR "slug" = '';

-- Handle duplicates by appending a suffix
WITH numbered AS (
  SELECT "id", "slug", ROW_NUMBER() OVER (PARTITION BY "slug" ORDER BY "createdAt") AS rn
  FROM "Player"
)
UPDATE "Player" p
SET "slug" = n."slug" || '-' || (n.rn - 1)
FROM numbered n
WHERE p."id" = n."id" AND n.rn > 1;

-- Now make it NOT NULL and UNIQUE
ALTER TABLE "Player" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");

-- CreateIndex
CREATE INDEX "Player_slug_idx" ON "Player"("slug");
