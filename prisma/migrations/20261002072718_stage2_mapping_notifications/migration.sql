-- CreateEnum
CREATE TYPE "VisitOutcome" AS ENUM ('CONTACTED', 'NEED_CONFIRMED', 'FOLLOW_UP_REQUIRED', 'HANDOVER_READY', 'NO_ACTION');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PIC_ASSIGNMENT', 'HANDOVER_ASSIGNMENT', 'FOLLOW_UP_PRE_DUE', 'FOLLOW_UP_DUE', 'OVERDUE_DIGEST');

-- CreateEnum
CREATE TYPE "OutboxJobType" AS ENUM ('FOLLOW_UP_PRE_DUE', 'FOLLOW_UP_DUE', 'OVERDUE_DIGEST');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('QUEUED', 'DRY_RUN', 'SMTP_ACCEPTED', 'FAILED', 'UNKNOWN', 'DISABLED', 'QUOTA_BLOCKED');

-- DropIndex
DROP INDEX "HandoverItem_prospectId_idx";

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "addressHint" VARCHAR(220),
ADD COLUMN     "areaBlock" VARCHAR(100),
ADD COLUMN     "businessSector" VARCHAR(100),
ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6),
ADD COLUMN     "productNeeds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "visitedAt" TIMESTAMPTZ(3) NOT NULL,
    "outcome" "VisitOutcome" NOT NULL,
    "notes" VARCHAR(700) NOT NULL,
    "nextAction" VARCHAR(300),
    "nextActionDueAt" TIMESTAMPTZ(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" BIGSERIAL NOT NULL,
    "recipientId" TEXT NOT NULL,
    "branchId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "link" VARCHAR(300) NOT NULL,
    "dedupKey" VARCHAR(180) NOT NULL,
    "followUpId" TEXT,
    "handoverId" TEXT,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxJob" (
    "id" TEXT NOT NULL,
    "type" "OutboxJobType" NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "dedupKey" VARCHAR(180) NOT NULL,
    "recipientId" TEXT NOT NULL,
    "branchId" TEXT,
    "followUpId" TEXT,
    "scheduleVersion" INTEGER,
    "runAt" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lockedBy" VARCHAR(100),
    "lockedAt" TIMESTAMPTZ(3),
    "leaseExpiresAt" TIMESTAMPTZ(3),
    "payload" JSONB,
    "lastError" VARCHAR(1000),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OutboxJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "outboxJobId" TEXT NOT NULL,
    "notificationId" BIGINT,
    "recipientId" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "messageId" VARCHAR(300),
    "preview" TEXT,
    "error" VARCHAR(1000),
    "acceptedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visit_prospectId_visitedAt_idx" ON "Visit"("prospectId", "visitedAt");

-- CreateIndex
CREATE INDEX "Visit_createdById_visitedAt_idx" ON "Visit"("createdById", "visitedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupKey_key" ON "Notification"("dedupKey");

-- CreateIndex
CREATE INDEX "Notification_recipientId_id_idx" ON "Notification"("recipientId", "id");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx" ON "Notification"("recipientId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_branchId_createdAt_idx" ON "Notification"("branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxJob_dedupKey_key" ON "OutboxJob"("dedupKey");

-- CreateIndex
CREATE INDEX "OutboxJob_status_runAt_idx" ON "OutboxJob"("status", "runAt");

-- CreateIndex
CREATE INDEX "OutboxJob_leaseExpiresAt_status_idx" ON "OutboxJob"("leaseExpiresAt", "status");

-- CreateIndex
CREATE INDEX "OutboxJob_recipientId_status_runAt_idx" ON "OutboxJob"("recipientId", "status", "runAt");

-- CreateIndex
CREATE INDEX "OutboxJob_followUpId_scheduleVersion_idx" ON "OutboxJob"("followUpId", "scheduleVersion");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDelivery_outboxJobId_key" ON "EmailDelivery"("outboxJobId");

-- CreateIndex
CREATE INDEX "EmailDelivery_recipientId_createdAt_idx" ON "EmailDelivery"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_status_createdAt_idx" ON "EmailDelivery"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_notificationId_idx" ON "EmailDelivery"("notificationId");

-- CreateIndex
CREATE INDEX "Prospect_branchId_areaBlock_businessSector_idx" ON "Prospect"("branchId", "areaBlock", "businessSector");

-- CreateIndex
CREATE INDEX "Prospect_latitude_longitude_idx" ON "Prospect"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "HandoverBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxJob" ADD CONSTRAINT "OutboxJob_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxJob" ADD CONSTRAINT "OutboxJob_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxJob" ADD CONSTRAINT "OutboxJob_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_outboxJobId_fkey" FOREIGN KEY ("outboxJobId") REFERENCES "OutboxJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
