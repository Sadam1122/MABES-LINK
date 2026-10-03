-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OUT_BRANCH', 'CS', 'SUPERVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('NEW', 'NEED_CONFIRMED', 'FOLLOW_UP', 'HANDOVER', 'PROCESSING', 'READY', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BatchType" AS ENUM ('SINGLE', 'PAYROLL');

-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'PROCESSING', 'ON_HOLD', 'ESCALATED', 'READY');

-- CreateEnum
CREATE TYPE "ExceptionCategory" AS ENUM ('OLD_PHONE_OTP', 'FACE_RECOGNITION', 'BLOCK_OR_ACTIVATION', 'OTHER_REAL_BLOCKER');

-- CreateEnum
CREATE TYPE "ExceptionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "UsageStatus" AS ENUM ('VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "classCode" VARCHAR(10) NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'OUT_BRANCH',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "branchId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ(3),
    "refreshTokenExpiresAt" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "internalCode" VARCHAR(30) NOT NULL,
    "cakraReference" VARCHAR(80),
    "businessAlias" VARCHAR(120) NOT NULL,
    "need" VARCHAR(500) NOT NULL,
    "contactPic" VARCHAR(100) NOT NULL,
    "opportunityStage" "OpportunityStage" NOT NULL DEFAULT 'NEW',
    "branchId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "summary" VARCHAR(500) NOT NULL,
    "nextAction" VARCHAR(300) NOT NULL,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PLANNED',
    "completedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" VARCHAR(30) NOT NULL,
    "type" "BatchType" NOT NULL DEFAULT 'SINGLE',
    "title" VARCHAR(150) NOT NULL,
    "status" "HandoverStatus" NOT NULL DEFAULT 'DRAFT',
    "branchId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT,
    "submittedAt" TIMESTAMPTZ(3),
    "acceptedAt" TIMESTAMPTZ(3),
    "readyAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "HandoverBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandoverItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExceptionCase" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "prospectId" TEXT,
    "category" "ExceptionCategory" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "detail" VARCHAR(700) NOT NULL,
    "status" "ExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "resolvedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ExceptionCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageVerification" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "status" "UsageStatus" NOT NULL DEFAULT 'VERIFIED',
    "usedAt" TIMESTAMPTZ(3) NOT NULL,
    "evidenceReference" VARCHAR(150) NOT NULL,
    "note" VARCHAR(500),
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "actorId" TEXT,
    "entityType" VARCHAR(60) NOT NULL,
    "entityId" VARCHAR(100) NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "requestId" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "description" VARCHAR(300),
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_code_idx" ON "Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_branchId_role_active_idx" ON "User"("branchId", "role", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE INDEX "Verification_expiresAt_idx" ON "Verification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_internalCode_key" ON "Prospect"("internalCode");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_cakraReference_key" ON "Prospect"("cakraReference");

-- CreateIndex
CREATE INDEX "Prospect_branchId_opportunityStage_updatedAt_idx" ON "Prospect"("branchId", "opportunityStage", "updatedAt");

-- CreateIndex
CREATE INDEX "Prospect_assignedToId_opportunityStage_idx" ON "Prospect"("assignedToId", "opportunityStage");

-- CreateIndex
CREATE INDEX "Prospect_businessAlias_idx" ON "Prospect"("businessAlias");

-- CreateIndex
CREATE INDEX "FollowUp_assignedToId_status_dueAt_idx" ON "FollowUp"("assignedToId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "FollowUp_prospectId_createdAt_idx" ON "FollowUp"("prospectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HandoverBatch_batchNumber_key" ON "HandoverBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "HandoverBatch_branchId_status_updatedAt_idx" ON "HandoverBatch"("branchId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "HandoverBatch_receiverId_status_idx" ON "HandoverBatch"("receiverId", "status");

-- CreateIndex
CREATE INDEX "HandoverBatch_senderId_status_idx" ON "HandoverBatch"("senderId", "status");

-- CreateIndex
CREATE INDEX "HandoverItem_prospectId_idx" ON "HandoverItem"("prospectId");

-- CreateIndex
CREATE UNIQUE INDEX "HandoverItem_batchId_prospectId_key" ON "HandoverItem"("batchId", "prospectId");

-- CreateIndex
CREATE INDEX "ExceptionCase_batchId_status_idx" ON "ExceptionCase"("batchId", "status");

-- CreateIndex
CREATE INDEX "ExceptionCase_prospectId_idx" ON "ExceptionCase"("prospectId");

-- CreateIndex
CREATE INDEX "ExceptionCase_assignedToId_status_idx" ON "ExceptionCase"("assignedToId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UsageVerification_evidenceReference_key" ON "UsageVerification"("evidenceReference");

-- CreateIndex
CREATE INDEX "UsageVerification_prospectId_status_usedAt_idx" ON "UsageVerification"("prospectId", "status", "usedAt");

-- CreateIndex
CREATE INDEX "UsageVerification_recordedById_createdAt_idx" ON "UsageVerification"("recordedById", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_branchId_createdAt_idx" ON "AuditLog"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverBatch" ADD CONSTRAINT "HandoverBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverBatch" ADD CONSTRAINT "HandoverBatch_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverBatch" ADD CONSTRAINT "HandoverBatch_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverItem" ADD CONSTRAINT "HandoverItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HandoverBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverItem" ADD CONSTRAINT "HandoverItem_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionCase" ADD CONSTRAINT "ExceptionCase_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HandoverBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionCase" ADD CONSTRAINT "ExceptionCase_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionCase" ADD CONSTRAINT "ExceptionCase_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageVerification" ADD CONSTRAINT "UsageVerification_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageVerification" ADD CONSTRAINT "UsageVerification_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
