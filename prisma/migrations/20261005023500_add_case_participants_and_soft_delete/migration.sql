-- Additive migration: appointments can have multiple internal PICs and
-- operational cards can be archived without destroying their audit history.
ALTER TABLE "ServiceCase"
ADD COLUMN "deletedAt" TIMESTAMPTZ(3);

CREATE TABLE "ServiceCaseParticipant" (
  "serviceCaseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceCaseParticipant_pkey" PRIMARY KEY ("serviceCaseId", "userId")
);

ALTER TABLE "ServiceCaseParticipant"
ADD CONSTRAINT "ServiceCaseParticipant_serviceCaseId_fkey"
FOREIGN KEY ("serviceCaseId") REFERENCES "ServiceCase"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceCaseParticipant"
ADD CONSTRAINT "ServiceCaseParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ServiceCaseParticipant_userId_createdAt_idx"
ON "ServiceCaseParticipant"("userId", "createdAt");

CREATE INDEX "ServiceCase_branchId_isTest_deletedAt_status_dueAt_idx"
ON "ServiceCase"("branchId", "isTest", "deletedAt", "status", "dueAt");

DROP INDEX IF EXISTS "ServiceCase_branchId_isTest_status_dueAt_idx";
