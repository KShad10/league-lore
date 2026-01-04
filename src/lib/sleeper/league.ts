import { ENDPOINTS } from './config';
import { fetchFromSleeper, fetchWithRetry } from './fetch';
import type {
  SleeperLeague,
  SleeperUser,
  SleeperRoster,
  SleeperMatchup,
  SleeperNflState,
  League,
  LeagueUser,
  Roster,
  Matchup,
  NflState,
  PlayoffSettings,
} from '@/types/sleeper';

/**
 * Fetch basic league information
 */
export async function getLeague(leagueId: string): Promise<League> {
  const data = await fetchFromSleeper<SleeperLeague>(ENDPOINTS.league(leagueId));
  
  if (!data) {
    throw new Error(`League ${leagueId} not found`);
  }
  
  return {
    leagueId: data.league_id,
    name: data.name,
    season: data.season,
    status: data.status,
    totalRosters: data.total_rosters,
    rosterPositions: data.roster_positions,
    scoringSettings: data.scoring_settings,
    previousLeagueId: data.previous_league_id,
    settings: extractPlayoffSettings(data.settings),
  };
}

/**
 * Extract and normalize playoff settings from Sleeper API
 */
function extractPlayoffSettings(settings: SleeperLeague['settings']): PlayoffSettings {
  return {
    playoffWeekStart: settings.playoff_week_start,
    playoffTeams: settings.playoff_teams,
    tradeDeadline: settings.trade_deadline,
    // Playoff format settings - default to standard values if not present
    playoffRoundType: settings.playoff_round_type ?? 0,    // 0=one week per round
    playoffSeedType: settings.playoff_seed_type ?? 0,      // 0=default brackets
    playoffType: settings.playoff_type ?? 0,               // 0=standard
    // Lower bracket settings - default to toilet bowl
    loserBracketType: settings.loser_bracket_type ?? 0,    // 0=toilet bowl
  };
}

/**
 * Fetch all users (managers) in a league
 */
export async function getLeagueUsers(leagueId: string): Promise<LeagueUser[]> {
  const data = await fetchFromSleeper<SleeperUser[]>(ENDPOINTS.leagueUsers(leagueId));
  
  if (!data) {
    return [];
  }
  
  return data.map(user => ({
    userId: user.user_id,
    displayName: user.display_name,
    avatar: user.avatar ? `https://sleepercdn.com/avatars/${user.avatar}` : null,
  }));
}

/**
 * Fetch all rosters in a league (links users to roster_ids)
 */
export async function getLeagueRosters(leagueId: string): Promise<Roster[]> {
  const data = await fetchFromSleeper<SleeperRoster[]>(ENDPOINTS.leagueRosters(leagueId));
  
  if (!data) {
    return [];
  }
  
  return data.map(roster => ({
    rosterId: roster.roster_id,
    ownerId: roster.owner_id,
    players: roster.players || [],
    starters: roster.starters || [],
    reserve: roster.reserve || [],
    settings: {
      wins: roster.settings.wins,
      losses: roster.settings.losses,
      ties: roster.settings.ties,
      fpts: roster.settings.fpts + (roster.settings.fpts_decimal || 0) / 100,
      fptsAgainst: roster.settings.fpts_against + (roster.settings.fpts_against_decimal || 0) / 100,
    }
  }));
}

/**
 * Fetch matchups for a specific week
 */
export async function getWeekMatchups(leagueId: string, week: number): Promise<Matchup[]> {
  const data = await fetchFromSleeper<SleeperMatchup[]>(ENDPOINTS.leagueMatchups(leagueId, week));
  
  if (!data || data.length === 0) {
    return []; // Week hasn't happened yet
  }
  
  return data.map(matchup => ({
    rosterId: matchup.roster_id,
    matchupId: matchup.matchup_id,
    points: matchup.points || 0,
    starters: matchup.starters || [],
    startersPoints: matchup.starters_points || [],
    players: matchup.players || [],
    playersPoints: matchup.players_points || {},
  }));
}

/**
 * Get current NFL state (season, week)
 */
export async function getNflState(): Promise<NflState> {
  const data = await fetchFromSleeper<SleeperNflState>(ENDPOINTS.nflState());
  
  if (!data) {
    throw new Error('Failed to fetch NFL state');
  }
  
  return {
    season: data.season,
    week: data.week,
    seasonType: data.season_type,
    displayWeek: data.display_week,
  };
}

/**
 * Walk the previous_league_id chain to get all seasons
 */
export async function getLeagueHistory(leagueId: string): Promise<League[]> {
  const leagues: League[] = [];
  let currentId: string | null = leagueId;
  
  while (currentId) {
    const league = await getLeague(currentId);
    leagues.push(league);
    currentId = league.previousLeagueId;
  }
  
  // Return in chronological order (oldest first)
  return leagues.reverse();
}

/**
 * Fetch all matchups for an entire season
 */
export async function getSeasonMatchups(leagueId: string, weeks: number = 17): Promise<Map<number, Matchup[]>> {
  const matchupsByWeek = new Map<number, Matchup[]>();
  
  for (let week = 1; week <= weeks; week++) {
    const matchups = await getWeekMatchups(leagueId, week);
    if (matchups.length > 0) {
      matchupsByWeek.set(week, matchups);
    }
  }
  
  return matchupsByWeek;
}

/**
 * Get complete league data for a single season
 */
export async function getLeagueSeasonData(leagueId: string) {
  const [league, users, rosters] = await Promise.all([
    getLeague(leagueId),
    getLeagueUsers(leagueId),
    getLeagueRosters(leagueId),
  ]);
  
  // Create user lookup by ID
  const userMap = new Map(users.map(u => [u.userId, u]));
  
  // Enrich rosters with user info
  const enrichedRosters = rosters.map(roster => ({
    ...roster,
    user: userMap.get(roster.ownerId) || null,
  }));
  
  return {
    league,
    users,
    rosters: enrichedRosters,
  };
}
