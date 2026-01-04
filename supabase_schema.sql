-- ============================================
-- LEAGUE LORE DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEAGUES
-- ============================================
CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sleeper_league_id TEXT NOT NULL,
  name TEXT NOT NULL,
  
  -- Current settings (most recent)
  team_count INT NOT NULL,
  roster_positions JSONB,
  scoring_settings JSONB,
  
  -- Configuration
  logo_url TEXT,
  color_palette TEXT DEFAULT 'classic',
  bylaws_text TEXT,
  
  -- Metadata
  first_season INT,
  current_season INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  
  UNIQUE(user_id, sleeper_league_id)
);

-- ============================================
-- LEAGUE SETTINGS HISTORY
-- ============================================
CREATE TABLE league_settings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  season INT NOT NULL,
  roster_positions JSONB NOT NULL,
  scoring_settings JSONB NOT NULL,
  notes TEXT,
  
  UNIQUE(league_id, season)
);

-- ============================================
-- MANAGERS
-- ============================================
CREATE TABLE managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  sleeper_user_id TEXT NOT NULL,
  sleeper_roster_id INT NOT NULL,
  
  -- Display settings
  current_username TEXT NOT NULL,
  display_name TEXT,
  nickname TEXT,
  avatar_url TEXT,
  
  -- Context for AI commentary
  context_notes TEXT,
  rivalry_notes JSONB,
  
  -- Flags
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(league_id, sleeper_user_id)
);

-- ============================================
-- MANAGER USERNAME HISTORY
-- ============================================
CREATE TABLE manager_username_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID REFERENCES managers(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  first_seen_season INT NOT NULL,
  last_seen_season INT,
  
  UNIQUE(manager_id, username)
);

-- ============================================
-- WEEKLY SCORES
-- ============================================
CREATE TABLE weekly_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES managers(id) ON DELETE CASCADE,
  season INT NOT NULL,
  week INT NOT NULL,
  
  -- Points
  points_for DECIMAL(10,2) NOT NULL,
  points_against DECIMAL(10,2),
  optimal_points DECIMAL(10,2),
  
  -- Opponent
  opponent_id UUID REFERENCES managers(id),
  matchup_id INT,
  
  -- Results
  h2h_win BOOLEAN,
  median_win BOOLEAN,
  weekly_rank INT,
  allplay_wins INT,
  allplay_losses INT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(league_id, manager_id, season, week)
);

-- ============================================
-- MATCHUPS
-- ============================================
CREATE TABLE matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  season INT NOT NULL,
  week INT NOT NULL,
  matchup_id INT NOT NULL,
  
  -- Team 1
  team1_manager_id UUID REFERENCES managers(id),
  team1_points DECIMAL(10,2),
  
  -- Team 2
  team2_manager_id UUID REFERENCES managers(id),
  team2_points DECIMAL(10,2),
  
  -- Result
  winner_manager_id UUID REFERENCES managers(id),
  point_differential DECIMAL(10,2),
  
  -- Flags
  is_playoff BOOLEAN DEFAULT FALSE,
  is_toilet_bowl BOOLEAN DEFAULT FALSE,
  playoff_round INT,
  
  UNIQUE(league_id, season, week, matchup_id)
);

-- ============================================
-- PLAYER SCORES
-- ============================================
CREATE TABLE player_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES managers(id) ON DELETE CASCADE,
  season INT NOT NULL,
  week INT NOT NULL,
  
  sleeper_player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  position TEXT NOT NULL,
  nfl_team TEXT,
  
  points DECIMAL(10,2) NOT NULL,
  is_starter BOOLEAN NOT NULL,
  lineup_slot TEXT,
  
  UNIQUE(league_id, manager_id, season, week, sleeper_player_id)
);

-- ============================================
-- REPORTS
-- ============================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  season INT NOT NULL,
  week INT NOT NULL,
  
  -- Configuration used
  template TEXT NOT NULL,
  voice TEXT NOT NULL,
  custom_voice_description TEXT,
  
  -- Content
  sections JSONB NOT NULL,
  
  -- Output
  pdf_url TEXT,
  html_content TEXT,
  
  -- Metadata
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  
  UNIQUE(league_id, season, week)
);

-- ============================================
-- EMAIL RECIPIENTS
-- ============================================
CREATE TABLE email_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  
  UNIQUE(league_id, email)
);

-- ============================================
-- COMPUTED VIEWS
-- ============================================

-- SEASON STANDINGS
CREATE VIEW season_standings AS
SELECT 
  ws.league_id,
  ws.manager_id,
  m.display_name,
  m.current_username,
  ws.season,
  
  COUNT(*) as weeks_played,
  SUM(CASE WHEN ws.h2h_win THEN 1 ELSE 0 END) as h2h_wins,
  SUM(CASE WHEN NOT ws.h2h_win THEN 1 ELSE 0 END) as h2h_losses,
  SUM(CASE WHEN ws.median_win THEN 1 ELSE 0 END) as median_wins,
  SUM(CASE WHEN NOT ws.median_win THEN 1 ELSE 0 END) as median_losses,
  SUM(CASE WHEN ws.h2h_win THEN 1 ELSE 0 END) + 
    SUM(CASE WHEN ws.median_win THEN 1 ELSE 0 END) as combined_wins,
  SUM(CASE WHEN NOT ws.h2h_win THEN 1 ELSE 0 END) + 
    SUM(CASE WHEN NOT ws.median_win THEN 1 ELSE 0 END) as combined_losses,
  
  SUM(ws.allplay_wins) as allplay_wins,
  SUM(ws.allplay_losses) as allplay_losses,
  
  SUM(ws.points_for) as total_pf,
  SUM(ws.points_against) as total_pa,
  AVG(ws.points_for) as avg_pf,
  SUM(ws.optimal_points) as total_optimal,
  
  CASE 
    WHEN SUM(ws.optimal_points) > 0 
    THEN ROUND((SUM(ws.points_for) / SUM(ws.optimal_points) * 100)::numeric, 2)
    ELSE NULL 
  END as efficiency_pct,
  
  RANK() OVER (
    PARTITION BY ws.league_id, ws.season 
    ORDER BY 
      SUM(CASE WHEN ws.h2h_win THEN 1 ELSE 0 END) + SUM(CASE WHEN ws.median_win THEN 1 ELSE 0 END) DESC,
      SUM(ws.points_for) DESC
  ) as current_rank

FROM weekly_scores ws
JOIN managers m ON ws.manager_id = m.id
GROUP BY ws.league_id, ws.manager_id, m.display_name, m.current_username, ws.season;

-- CAREER STATS
CREATE VIEW career_stats AS
SELECT 
  ws.league_id,
  ws.manager_id,
  m.display_name,
  m.current_username,
  
  COUNT(*) as total_weeks,
  SUM(CASE WHEN ws.h2h_win THEN 1 ELSE 0 END) as career_h2h_wins,
  SUM(CASE WHEN NOT ws.h2h_win THEN 1 ELSE 0 END) as career_h2h_losses,
  SUM(CASE WHEN ws.median_win THEN 1 ELSE 0 END) as career_median_wins,
  SUM(CASE WHEN NOT ws.median_win THEN 1 ELSE 0 END) as career_median_losses,
  SUM(ws.allplay_wins) as career_allplay_wins,
  SUM(ws.allplay_losses) as career_allplay_losses,
  SUM(ws.points_for) as career_pf,
  AVG(ws.points_for) as career_avg_pf,
  
  ROUND((SUM(CASE WHEN ws.h2h_win THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100), 2) as h2h_win_pct,
  ROUND((SUM(ws.allplay_wins)::numeric / (SUM(ws.allplay_wins) + SUM(ws.allplay_losses)) * 100), 2) as allplay_win_pct

FROM weekly_scores ws
JOIN managers m ON ws.manager_id = m.id
GROUP BY ws.league_id, ws.manager_id, m.display_name, m.current_username;

-- HEAD-TO-HEAD RECORDS
CREATE VIEW h2h_records AS
SELECT 
  ws.league_id,
  ws.manager_id as manager1_id,
  m1.display_name as manager1_name,
  ws.opponent_id as manager2_id,
  m2.display_name as manager2_name,
  
  COUNT(*) as total_matchups,
  SUM(CASE WHEN ws.h2h_win THEN 1 ELSE 0 END) as wins,
  SUM(CASE WHEN NOT ws.h2h_win THEN 1 ELSE 0 END) as losses,
  SUM(ws.points_for) as total_pf,
  SUM(ws.points_against) as total_pa

FROM weekly_scores ws
JOIN managers m1 ON ws.manager_id = m1.id
JOIN managers m2 ON ws.opponent_id = m2.id
WHERE ws.opponent_id IS NOT NULL
GROUP BY ws.league_id, ws.manager_id, m1.display_name, ws.opponent_id, m2.display_name;

-- WEEKLY RANKINGS
CREATE VIEW weekly_rankings AS
SELECT 
  league_id,
  season,
  week,
  manager_id,
  points_for,
  RANK() OVER (PARTITION BY league_id, season, week ORDER BY points_for DESC) as rank,
  COUNT(*) OVER (PARTITION BY league_id, season, week) as team_count
FROM weekly_scores;

-- ============================================
-- STREAK CALCULATION FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION calculate_current_streak(
  p_league_id UUID,
  p_manager_id UUID,
  p_season INT,
  p_through_week INT
)
RETURNS TABLE(streak_type TEXT, streak_length INT) AS $$
DECLARE
  v_results TEXT[];
  v_current_result TEXT;
  v_streak_type TEXT;
  v_streak_count INT := 0;
  v_record RECORD;
BEGIN
  v_results := ARRAY[]::TEXT[];
  
  FOR v_record IN 
    SELECT week, h2h_win, median_win
    FROM weekly_scores
    WHERE league_id = p_league_id 
      AND manager_id = p_manager_id 
      AND season = p_season
      AND week <= p_through_week
    ORDER BY week DESC
  LOOP
    IF v_record.median_win THEN
      v_results := array_append(v_results, 'W');
    ELSE
      v_results := array_append(v_results, 'L');
    END IF;
    
    IF v_record.h2h_win THEN
      v_results := array_append(v_results, 'W');
    ELSE
      v_results := array_append(v_results, 'L');
    END IF;
  END LOOP;
  
  IF array_length(v_results, 1) > 0 THEN
    v_streak_type := v_results[1];
    v_streak_count := 0;
    
    FOR i IN 1..array_length(v_results, 1) LOOP
      IF v_results[i] = v_streak_type THEN
        v_streak_count := v_streak_count + 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  RETURN QUERY SELECT v_streak_type, v_streak_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
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

-- Users can only see their own data
CREATE POLICY "Users can access own record" ON users
  FOR ALL USING (id = auth.uid());

CREATE POLICY "Users can access own leagues" ON leagues
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can access own league settings" ON league_settings_history
  FOR ALL USING (league_id IN (SELECT id FROM leagues WHERE user_id = auth.uid()));

CREATE POLICY "Users can access own managers" ON managers
  FOR ALL USING (league_id IN (SELECT id FROM leagues WHERE user_id = auth.uid()));

CREATE POLICY "Users can access own manager history" ON manager_username_history
  FOR ALL USING (manager_id IN (
    SELECT m.id FROM managers m 
    JOIN leagues l ON m.league_id = l.id 
    WHERE l.user_id = auth.uid()
  ));

CREATE POLICY "Users can access own weekly scores" ON weekly_scores
  FOR ALL USING (league_id IN (SELECT id FROM leagues WHERE user_id = auth.uid()));

CREATE POLICY "Users can access own matchups" ON matchups
  FOR ALL USING (league_id IN (SELECT id FROM leagues WHERE user_id = auth.uid()));

CREATE POLICY "Users can access own player scores" ON player_scores
  FOR ALL USING (league_id IN (SELECT id FROM leagues WHERE user_id = auth.uid()));

CREATE POLICY "Users can access own reports" ON reports
  FOR ALL USING (league_id IN (SELECT id FROM leagues WHERE user_id = auth.uid()));

CREATE POLICY "Users can access own email recipients" ON email_recipients
  FOR ALL USING (league_id IN (SELECT id FROM leagues WHERE user_id = auth.uid()));
