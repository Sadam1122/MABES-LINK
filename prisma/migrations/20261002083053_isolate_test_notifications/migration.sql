-- DropIndex
DROP INDEX "Notification_recipientId_id_idx";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "testNamespace" VARCHAR(80);

-- AlterTable
ALTER TABLE "OutboxJob" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "testNamespace" VARCHAR(80);

-- CreateIndex
CREATE INDEX "Notification_recipientId_isTest_id_idx" ON "Notification"("recipientId", "isTest", "id");
