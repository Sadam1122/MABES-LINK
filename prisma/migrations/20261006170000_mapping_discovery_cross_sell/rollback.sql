-- Hanya untuk rollback terencana setelah backup dan persetujuan pemilik data.
-- Menjalankan berkas ini akan menghapus catatan discovery/cross-sell yang dibuat setelah migrasi.
DROP TABLE IF EXISTS "MappingOpportunity";
DROP TABLE IF EXISTS "MappingDiscovery";
DROP TYPE IF EXISTS "MappingOfferResponse";
DROP TYPE IF EXISTS "FoodScreenRule";
