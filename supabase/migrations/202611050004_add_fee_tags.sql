-- Add fee_tags jsonb column to operational_settings
-- Stores an array of { label: string, percent: string } objects
ALTER TABLE operational_settings
  ADD COLUMN IF NOT EXISTS fee_tags jsonb DEFAULT '[]'::jsonb;
