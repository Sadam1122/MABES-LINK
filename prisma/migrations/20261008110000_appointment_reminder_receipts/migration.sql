-- Additive only. No existing account, appointment, location or read state is overwritten.
ALTER TABLE "Prospect" ADD COLUMN "locationVerifiedAt" TIMESTAMPTZ(3);
ALTER TABLE "Notification" ADD COLUMN "popupClaimedAt" TIMESTAMPTZ(3),
  ADD COLUMN "audioClaimedAt" TIMESTAMPTZ(3),
  ADD COLUMN "reminderExpiresAt" TIMESTAMPTZ(3);
