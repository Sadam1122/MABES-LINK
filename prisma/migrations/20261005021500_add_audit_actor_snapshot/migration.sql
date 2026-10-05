-- Snapshot identitas operasional pada saat audit dibuat. Nullable menjaga
-- seluruh audit existing tetap valid tanpa backfill atau reset database.
ALTER TABLE "AuditLog"
  ADD COLUMN "actorName" VARCHAR(120),
  ADD COLUMN "actorRole" "Role";
