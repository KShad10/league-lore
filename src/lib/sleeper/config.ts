export const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

export const ENDPOINTS = {
  // League endpoints
  league: (leagueId: string) => `${SLEEPER_API_BASE}/league/${leagueId}`,
  leagueUsers: (leagueId: string) => `${SLEEPER_API_BASE}/league/${leagueId}/users`,
  leagueRosters: (leagueId: string) => `${SLEEPER_API_BASE}/league/${leagueId}/rosters`,
  leagueMatchups: (leagueId: string, week: number) => `${SLEEPER_API_BASE}/league/${leagueId}/matchups/${week}`,
  leagueDrafts: (leagueId: string) => `${SLEEPER_API_BASE}/league/${leagueId}/drafts`,
  leagueTransactions: (leagueId: string, week: number) => `${SLEEPER_API_BASE}/league/${leagueId}/transactions/${week}`,
  
  // User endpoints
  user: (username: string) => `${SLEEPER_API_BASE}/user/${username}`,
  userLeagues: (userId: string, season: string) => `${SLEEPER_API_BASE}/user/${userId}/leagues/nfl/${season}`,
  
  // Player data (static, updated daily)
  allPlayers: () => `${SLEEPER_API_BASE}/players/nfl`,
  
  // State (current NFL week)
  nflState: () => `${SLEEPER_API_BASE}/state/nfl`,
};
