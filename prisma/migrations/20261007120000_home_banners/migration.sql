CREATE TABLE "HomeBanner" (
  "id" TEXT NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(240),
  "storageKey" VARCHAR(180) NOT NULL,
  "mimeType" VARCHAR(40) NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "branchId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "HomeBanner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HomeBanner_storageKey_key" ON "HomeBanner"("storageKey");
CREATE INDEX "HomeBanner_branchId_active_sortOrder_createdAt_idx" ON "HomeBanner"("branchId", "active", "sortOrder", "createdAt");
CREATE INDEX "HomeBanner_createdById_createdAt_idx" ON "HomeBanner"("createdById", "createdAt");
ALTER TABLE "HomeBanner" ADD CONSTRAINT "HomeBanner_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HomeBanner" ADD CONSTRAINT "HomeBanner_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
