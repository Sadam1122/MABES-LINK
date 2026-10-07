ALTER TABLE "Prospect"
  ADD COLUMN "publicQrisTemplate" VARCHAR(40),
  ADD COLUMN "publicQrisDesignedAt" TIMESTAMPTZ(3);

ALTER TABLE "QrisDesignSession"
  ADD COLUMN "publicRequestId" VARCHAR(80),
  ADD COLUMN "selectedTemplate" VARCHAR(40);

CREATE INDEX "Prospect_branchId_publicQrisDesignedAt_idx"
  ON "Prospect"("branchId", "publicQrisDesignedAt");
