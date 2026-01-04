-- ============================================
-- TEMPORARY: Disable RLS for testing
-- Run this to allow sync without authentication
-- RE-ENABLE RLS before production!
-- ============================================

-- Disable RLS on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE leagues DISABLE ROW LEVEL SECURITY;
ALTER TABLE league_settings_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE managers DISABLE ROW LEVEL SECURITY;
ALTER TABLE manager_username_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE matchups DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_recipients DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'leagues', 'managers', 'weekly_scores', 'matchups');
