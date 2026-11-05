-- Add revenue_forecast_cents to operational_settings for break-even calculation
ALTER TABLE operational_settings
  ADD COLUMN IF NOT EXISTS revenue_forecast_cents bigint;
