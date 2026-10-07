ALTER TABLE "Prospect" ADD COLUMN "mappingImportedAt" TIMESTAMPTZ(3);

UPDATE "Prospect" SET "mappingImportedAt" = COALESCE("locationUpdatedAt", "updatedAt")
WHERE "locationSource" = 'EXCEL_IMPORT' AND "mappingImportedAt" IS NULL;

CREATE INDEX "Prospect_branchId_mappingImportedAt_idx" ON "Prospect"("branchId", "mappingImportedAt");
