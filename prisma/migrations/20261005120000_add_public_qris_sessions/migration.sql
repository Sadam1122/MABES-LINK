-- Sesi desain dan metadata prospek ditambahkan tanpa mengubah data sebelumnya.
ALTER TABLE "Prospect"
  ALTER COLUMN "createdById" DROP NOT NULL,
  ADD COLUMN "publicQrisRequestId" VARCHAR(80),
  ADD COLUMN "publicDedupKey" VARCHAR(64),
  ADD COLUMN "publicContactPhone" VARCHAR(30),
  ADD COLUMN "publicBusinessCategory" VARCHAR(100),
  ADD COLUMN "publicBankRelationship" VARCHAR(30),
  ADD COLUMN "publicContactWindow" VARCHAR(100),
  ADD COLUMN "publicContactConsentAt" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "Prospect_publicQrisRequestId_key" ON "Prospect"("publicQrisRequestId");
CREATE UNIQUE INDEX "Prospect_publicDedupKey_key" ON "Prospect"("publicDedupKey");
CREATE INDEX "Prospect_branchId_publicContactConsentAt_idx" ON "Prospect"("branchId", "publicContactConsentAt");

CREATE TABLE "QrisDesignSession" (
  "id" TEXT NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "storageKey" VARCHAR(180) NOT NULL,
  "mimeType" VARCHAR(60) NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "qrDigest" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "QrisDesignSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QrisDesignSession_storageKey_key" ON "QrisDesignSession"("storageKey");
CREATE INDEX "QrisDesignSession_expiresAt_idx" ON "QrisDesignSession"("expiresAt");

CREATE TABLE "PublicRateLimit" (
  "key" VARCHAR(80) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowEnd" TIMESTAMPTZ(3) NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PublicRateLimit_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "PublicRateLimit_windowEnd_idx" ON "PublicRateLimit"("windowEnd");
