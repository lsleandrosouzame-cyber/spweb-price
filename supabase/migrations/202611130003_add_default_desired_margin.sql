-- Add default desired margin percent to operational_settings
ALTER TABLE operational_settings
ADD COLUMN default_desired_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN operational_settings.default_desired_margin_percent IS 'Default desired profit margin percentage for all products and services (can be overridden per item)';
