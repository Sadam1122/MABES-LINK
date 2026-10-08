-- Additive: existing recipients, receipts and appointment data are retained.
ALTER TABLE "Notification"
  ADD COLUMN "alarmDismissedAt" TIMESTAMPTZ(3),
  ADD COLUMN "snoozedUntil" TIMESTAMPTZ(3);
