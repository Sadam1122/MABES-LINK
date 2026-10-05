-- Katalog/progress akuisisi ditambahkan secara aditif; pekerjaan existing tetap dipertahankan.
CREATE TYPE "AcquisitionStatus" AS ENUM ('PROSPECT', 'FOLLOW_UP', 'PROCESS', 'SUCCESS', 'UNSUCCESSFUL');
CREATE TYPE "AcquisitionMetricUnit" AS ENUM ('CUSTOMER', 'ACCOUNT', 'MERCHANT', 'IDR');

ALTER TABLE "ServiceCase"
  ADD COLUMN "acquisitionCategory" VARCHAR(40),
  ADD COLUMN "acquisitionProduct" VARCHAR(80),
  ADD COLUMN "acquisitionStatus" "AcquisitionStatus" NOT NULL DEFAULT 'PROSPECT',
  ADD COLUMN "targetValue" DECIMAL(18,2),
  ADD COLUMN "realizationValue" DECIMAL(18,2),
  ADD COLUMN "metricUnit" "AcquisitionMetricUnit",
  ADD COLUMN "customerCif" VARCHAR(40),
  ADD COLUMN "customerAccount" VARCHAR(40),
  ADD COLUMN "customerPhone" VARCHAR(30);

CREATE INDEX "ServiceCase_branchId_acquisitionCategory_acquisitionStatus_idx"
  ON "ServiceCase"("branchId", "acquisitionCategory", "acquisitionStatus");
