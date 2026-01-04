-- ============================================
-- RE-ENABLE RLS for production
-- Run this after testing is complete
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_settings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_username_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_recipients ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'leagues', 'managers', 'weekly_scores', 'matchups');
