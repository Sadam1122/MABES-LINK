CREATE TYPE "FoodScreenRule" AS ENUM ('EITHER', 'BOTH');
CREATE TYPE "MappingOfferResponse" AS ENUM ('NOT_ASKED', 'INTERESTED', 'FOLLOW_UP', 'NOT_INTERESTED', 'NOT_RELEVANT');

CREATE TABLE "MappingDiscovery" (
  "id" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "segments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "opportunityTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "usedProductsKnown" BOOLEAN NOT NULL DEFAULT false,
  "usedProducts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "usedProductsOther" VARCHAR(120),
  "sourceType" VARCHAR(40),
  "sourceUrl" VARCHAR(300),
  "sourceCheckedAt" TIMESTAMPTZ(3),
  "riskReviewRequired" BOOLEAN NOT NULL DEFAULT false,
  "foodRule" "FoodScreenRule" NOT NULL DEFAULT 'EITHER',
  "gofoodRating" DECIMAL(2,1),
  "gofoodReviews" INTEGER,
  "gofoodUrl" VARCHAR(300),
  "gofoodCheckedAt" TIMESTAMPTZ(3),
  "grabfoodRating" DECIMAL(2,1),
  "grabfoodReviews" INTEGER,
  "grabfoodUrl" VARCHAR(300),
  "grabfoodCheckedAt" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "MappingDiscovery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MappingOpportunity" (
  "id" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "productCode" VARCHAR(80) NOT NULL,
  "needSummary" VARCHAR(300) NOT NULL,
  "discoveredAt" TIMESTAMPTZ(3),
  "needConfirmedAt" TIMESTAMPTZ(3),
  "benefitExplainedAt" TIMESTAMPTZ(3),
  "response" "MappingOfferResponse" NOT NULL DEFAULT 'NOT_ASKED',
  "followUpConsent" BOOLEAN,
  "nextAction" VARCHAR(300),
  "dueAt" TIMESTAMPTZ(3),
  "evidenceNote" VARCHAR(500),
  "assignedToId" TEXT NOT NULL,
  "followUpId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "MappingOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MappingDiscovery_prospectId_key" ON "MappingDiscovery"("prospectId");
CREATE INDEX "MappingDiscovery_riskReviewRequired_updatedAt_idx" ON "MappingDiscovery"("riskReviewRequired", "updatedAt");
CREATE UNIQUE INDEX "MappingOpportunity_prospectId_productCode_key" ON "MappingOpportunity"("prospectId", "productCode");
CREATE UNIQUE INDEX "MappingOpportunity_followUpId_key" ON "MappingOpportunity"("followUpId");
CREATE INDEX "MappingOpportunity_assignedToId_response_dueAt_idx" ON "MappingOpportunity"("assignedToId", "response", "dueAt");
CREATE INDEX "MappingOpportunity_prospectId_updatedAt_idx" ON "MappingOpportunity"("prospectId", "updatedAt");

ALTER TABLE "MappingDiscovery" ADD CONSTRAINT "MappingDiscovery_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MappingOpportunity" ADD CONSTRAINT "MappingOpportunity_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MappingOpportunity" ADD CONSTRAINT "MappingOpportunity_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MappingOpportunity" ADD CONSTRAINT "MappingOpportunity_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
