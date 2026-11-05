-- Add pro_labore_cents to operational_settings
ALTER TABLE operational_settings
  ADD COLUMN IF NOT EXISTS pro_labore_cents bigint;
