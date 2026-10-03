-- Menjamin satu prospek hanya masuk ke satu alur handover.
-- Pemeriksaan duplikasi juga dilakukan di service sebelum insert.
CREATE UNIQUE INDEX "HandoverItem_prospectId_key" ON "HandoverItem"("prospectId");
