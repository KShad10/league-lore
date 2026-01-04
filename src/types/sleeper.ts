// ============================================
// SLEEPER API RESPONSE TYPES
// ============================================

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: 'pre_draft' | 'drafting' | 'in_season' | 'complete';
  total_rosters: number;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  previous_league_id: string | null;
  settings: {
    playoff_week_start: number;
    playoff_teams: number;
    trade_deadline: number;
    // Playoff format settings
    playoff_round_type?: number;  // 0=one week, 1=two week champ, 2=two weeks all
    playoff_seed_type?: number;   // 0=default brackets, 1=re-seed each round
    playoff_type?: number;        // 0=standard, 1=two weeks per matchup
    // Lower bracket settings
    loser_bracket_type?: number;  // 0=toilet bowl (losers advance), 1=consolation (winners advance)
    [key: string]: number | undefined;
  };
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal?: number;
    fpts_against: number;
    fpts_against_decimal?: number;
  };
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number;
  points: number;
  starters: string[] | null;
  starters_points: number[] | null;
  players: string[] | null;
  players_points: Record<string, number> | null;
}

export interface SleeperNflState {
  season: string;
  week: number;
  season_type: 'pre' | 'regular' | 'post';
  display_week: number;
}

// ============================================
// TRANSFORMED TYPES (App-internal)
// ============================================

export interface League {
  leagueId: string;
  name: string;
  season: string;
  status: string;
  totalRosters: number;
  rosterPositions: string[];
  scoringSettings: Record<string, number>;
  previousLeagueId: string | null;
  settings: PlayoffSettings;
}

export interface PlayoffSettings {
  playoffWeekStart: number;
  playoffTeams: number;
  tradeDeadline: number;
  // Playoff format settings
  playoffRoundType: number;     // 0=one week, 1=two week champ, 2=two weeks all
  playoffSeedType: number;      // 0=default brackets, 1=re-seed each round
  playoffType: number;          // 0=standard, 1=two weeks per matchup
  // Lower bracket settings
  loserBracketType: number;     // 0=toilet bowl (losers advance), 1=consolation (winners advance)
}

export interface LeagueUser {
  userId: string;
  displayName: string;
  avatar: string | null;
}

export interface Roster {
  rosterId: number;
  ownerId: string;
  players: string[];
  starters: string[];
  reserve: string[];
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fptsAgainst: number;
  };
}

export interface Matchup {
  rosterId: number;
  matchupId: number;
  points: number;
  starters: string[];
  startersPoints: number[];
  players: string[];
  playersPoints: Record<string, number>;
}

export interface NflState {
  season: string;
  week: number;
  seasonType: string;
  displayWeek: number;
}

// ============================================
// DATABASE TYPES
// ============================================

export interface DbLeague {
  id: string;
  user_id: string;
  sleeper_league_id: string;
  name: string;
  team_count: number;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  logo_url: string | null;
  color_palette: string;
  bylaws_text: string | null;
  first_season: number;
  current_season: number;
  created_at: string;
  updated_at: string;
  last_sync_at: string | null;
}

export interface DbManager {
  id: string;
  league_id: string;
  sleeper_user_id: string;
  sleeper_roster_id: number;
  current_username: string;
  display_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  context_notes: string | null;
  rivalry_notes: Record<string, string> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbWeeklyScore {
  id: string;
  league_id: string;
  manager_id: string;
  season: number;
  week: number;
  points_for: number;
  points_against: number | null;
  optimal_points: number | null;
  opponent_id: string | null;
  matchup_id: number | null;
  h2h_win: boolean | null;
  median_win: boolean | null;
  weekly_rank: number | null;
  allplay_wins: number | null;
  allplay_losses: number | null;
  created_at: string;
}

export interface DbMatchup {
  id: string;
  league_id: string;
  season: number;
  week: number;
  matchup_id: number;
  team1_manager_id: string;
  team1_points: number;
  team2_manager_id: string;
  team2_points: number;
  winner_manager_id: string | null;
  point_differential: number;
  is_playoff: boolean;
  is_toilet_bowl: boolean;
  playoff_round: number | null;
}
