-- AlterTable: add slug as nullable first
ALTER TABLE "Tournament" ADD COLUMN "slug" TEXT;

-- Backfill: generate slugs from existing tournament names
UPDATE "Tournament" SET "slug" = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRANSLATE(
          LOWER("name"),
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

-- Handle any NULLs (empty names) with fallback
UPDATE "Tournament" SET "slug" = 'torneo-' || SUBSTRING("id" FROM 1 FOR 8) WHERE "slug" IS NULL OR "slug" = '';

-- Handle duplicates by appending a suffix
WITH duplicates AS (
  SELECT "id", "slug", ROW_NUMBER() OVER (PARTITION BY "slug" ORDER BY "createdAt") AS rn
  FROM "Tournament"
)
UPDATE "Tournament" t
SET "slug" = d."slug" || '-' || d.rn
FROM duplicates d
WHERE t."id" = d."id" AND d.rn > 1;

-- Now make it NOT NULL and UNIQUE
ALTER TABLE "Tournament" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_slug_key" ON "Tournament"("slug");

-- CreateIndex
CREATE INDEX "Tournament_slug_idx" ON "Tournament"("slug");
