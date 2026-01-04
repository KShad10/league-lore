-- Report Drafts table for saving in-progress reports
-- Run this migration in your Supabase SQL editor

-- Create the report_drafts table
CREATE TABLE IF NOT EXISTS report_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  week INTEGER, -- NULL for postseason reports
  report_type TEXT NOT NULL DEFAULT 'weekly', -- 'weekly' or 'postseason'
  html_content TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one draft per user/league/season/week/type combo
  UNIQUE(league_id, user_id, season, week, report_type)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_report_drafts_league_id ON report_drafts(league_id);
CREATE INDEX IF NOT EXISTS idx_report_drafts_user_id ON report_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_report_drafts_lookup ON report_drafts(league_id, user_id, season, week, report_type);

-- Enable Row Level Security
ALTER TABLE report_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own drafts
CREATE POLICY "Users can access own drafts" ON report_drafts
  FOR ALL
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_report_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS report_drafts_updated_at ON report_drafts;
CREATE TRIGGER report_drafts_updated_at
  BEFORE UPDATE ON report_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_report_drafts_updated_at();

-- Grant permissions
GRANT ALL ON report_drafts TO authenticated;
GRANT ALL ON report_drafts TO service_role;
