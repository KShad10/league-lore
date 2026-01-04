-- Add league_settings column to store non-scoring settings like playoff_week_start
ALTER TABLE league_settings_history 
ADD COLUMN IF NOT EXISTS league_settings JSONB;

-- Add comment explaining the column
COMMENT ON COLUMN league_settings_history.league_settings IS 'Non-scoring league settings including playoff_week_start, playoff_teams, trade_deadline, etc.';
