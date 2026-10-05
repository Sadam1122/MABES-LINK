-- Menambahkan gaya marker tanpa mengubah atau menghapus data mapping yang ada.
CREATE TYPE "MappingMarkerIcon" AS ENUM ('STORE', 'FOOD', 'MARKET', 'OFFICE', 'HEALTH', 'SERVICE');

ALTER TABLE "Prospect"
ADD COLUMN "mappingMarkerIcon" "MappingMarkerIcon" NOT NULL DEFAULT 'STORE';
