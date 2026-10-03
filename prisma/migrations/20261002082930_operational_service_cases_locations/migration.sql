-- CreateEnum
CREATE TYPE "ServiceCaseStatus" AS ENUM ('CREATED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_SYSTEM', 'ESCALATED', 'HANDLED', 'VERIFIED', 'CLOSED', 'REOPENED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('NEEDS_SCHEDULING', 'PENDING_CONFIRMATION', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CaseOrigin" AS ENUM ('IN_BRANCH', 'OUT_BRANCH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SERVICE_ASSIGNMENT';
ALTER TYPE "NotificationType" ADD VALUE 'SERVICE_STATUS';
ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_ACTION_DUE';
ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_PRE_DUE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OutboxJobType" ADD VALUE 'APPOINTMENT_ACTION_DUE';
ALTER TYPE "OutboxJobType" ADD VALUE 'APPOINTMENT_PRE_DUE';

-- DropIndex
DROP INDEX "Prospect_branchId_opportunityStage_updatedAt_idx";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "serviceCaseId" TEXT;

-- AlterTable
ALTER TABLE "OutboxJob" ADD COLUMN     "serviceCaseId" TEXT;

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locationLabel" VARCHAR(120),
ADD COLUMN     "locationUpdatedAt" TIMESTAMPTZ(3),
ADD COLUMN     "testNamespace" VARCHAR(80),
ALTER COLUMN "latitude" SET DATA TYPE DECIMAL(10,7),
ALTER COLUMN "longitude" SET DATA TYPE DECIMAL(10,7);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ServiceCase" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(36) NOT NULL,
    "branchId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "origin" "CaseOrigin" NOT NULL,
    "status" "ServiceCaseStatus" NOT NULL DEFAULT 'CREATED',
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(700) NOT NULL,
    "picId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "acceptedById" TEXT,
    "nextAction" VARCHAR(300) NOT NULL,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "appointmentStatus" "AppointmentStatus" NOT NULL DEFAULT 'NEEDS_SCHEDULING',
    "appointmentAt" TIMESTAMPTZ(3),
    "acceptedAt" TIMESTAMPTZ(3),
    "handledAt" TIMESTAMPTZ(3),
    "verifiedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "reopenedAt" TIMESTAMPTZ(3),
    "waitReason" VARCHAR(500),
    "escalationReason" VARCHAR(500),
    "sourceSystem" VARCHAR(40),
    "sourceReference" VARCHAR(100),
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "testNamespace" VARCHAR(80),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ServiceCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationPhoto" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "storageKey" VARCHAR(180) NOT NULL,
    "mimeType" VARCHAR(60) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LocationPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" VARCHAR(100) NOT NULL,
    "processId" INTEGER NOT NULL,
    "hostname" VARCHAR(160) NOT NULL,
    "lastSeen" TIMESTAMPTZ(3) NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCase_code_key" ON "ServiceCase"("code");

-- CreateIndex
CREATE INDEX "ServiceCase_branchId_isTest_status_dueAt_idx" ON "ServiceCase"("branchId", "isTest", "status", "dueAt");

-- CreateIndex
CREATE INDEX "ServiceCase_picId_isTest_status_dueAt_idx" ON "ServiceCase"("picId", "isTest", "status", "dueAt");

-- CreateIndex
CREATE INDEX "ServiceCase_prospectId_createdAt_idx" ON "ServiceCase"("prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceCase_appointmentStatus_appointmentAt_idx" ON "ServiceCase"("appointmentStatus", "appointmentAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCase_sourceSystem_sourceReference_key" ON "ServiceCase"("sourceSystem", "sourceReference");

-- CreateIndex
CREATE UNIQUE INDEX "LocationPhoto_storageKey_key" ON "LocationPhoto"("storageKey");

-- CreateIndex
CREATE INDEX "LocationPhoto_prospectId_createdAt_idx" ON "LocationPhoto"("prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_serviceCaseId_id_idx" ON "Notification"("serviceCaseId", "id");

-- CreateIndex
CREATE INDEX "OutboxJob_serviceCaseId_scheduleVersion_idx" ON "OutboxJob"("serviceCaseId", "scheduleVersion");

-- CreateIndex
CREATE INDEX "Prospect_branchId_isTest_opportunityStage_updatedAt_idx" ON "Prospect"("branchId", "isTest", "opportunityStage", "updatedAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "ServiceCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxJob" ADD CONSTRAINT "OutboxJob_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "ServiceCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCase" ADD CONSTRAINT "ServiceCase_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCase" ADD CONSTRAINT "ServiceCase_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCase" ADD CONSTRAINT "ServiceCase_picId_fkey" FOREIGN KEY ("picId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCase" ADD CONSTRAINT "ServiceCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCase" ADD CONSTRAINT "ServiceCase_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationPhoto" ADD CONSTRAINT "LocationPhoto_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationPhoto" ADD CONSTRAINT "LocationPhoto_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
