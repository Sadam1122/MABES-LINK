-- Rollback is destructive for source hints and must be reviewed/backed up first.
ALTER TABLE "MappingDiscovery" DROP COLUMN "sourceNeedHint";
