// ============================================
// SHARED API TYPES
// ============================================

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Standard route params for league-scoped API routes
 */
export interface LeagueRouteParams {
  params: Promise<{ leagueId: string }>;
}

/**
 * Route params for manager-specific endpoints
 */
export interface ManagerRouteParams {
  params: Promise<{ leagueId: string; managerId: string }>;
}

/**
 * Authenticated request context passed to route handlers
 */
export interface AuthContext {
  userId: string;
  supabase: SupabaseClient;
}

/**
 * Standard API response wrapper for success cases
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  [key: string]: unknown;
}

/**
 * Standard API response wrapper for error cases
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Common query parameters across league endpoints
 */
export interface LeagueQueryParams {
  season?: number;
  week?: number;
  managerId?: string;
  includePlayoffs?: boolean;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/**
 * Standard record stats shape (wins/losses)
 */
export interface RecordStats {
  wins: number;
  losses: number;
  winPct?: number;
}

/**
 * Combined record stats (H2H + Median)
 */
export interface CombinedRecord {
  h2h: RecordStats;
  median: RecordStats;
  combined: RecordStats;
  allPlay: RecordStats;
}

/**
 * Points statistics
 */
export interface PointsStats {
  for: number;
  against: number;
  avgPerWeek?: number;
  forRank?: number;
  againstRank?: number;
}

/**
 * Manager info from Supabase join
 */
export interface ManagerJoinResult {
  id?: string;
  current_username: string;
  display_name: string | null;
}

/**
 * Helper to extract manager name from join result
 */
export function getManagerName(manager: ManagerJoinResult | null): string {
  if (!manager) return 'Unknown';
  return manager.display_name || manager.current_username;
}

/**
 * Playoff settings map type
 */
export type PlayoffStartMap = Map<number, number>;

/**
 * Season standings entry (shared across routes)
 */
export interface StandingEntry {
  managerId: string;
  username: string;
  displayName: string;
  season: number;
  record: CombinedRecord;
  points: PointsStats;
  weeksPlayed: number;
  rank?: number;
  seasonRank?: number;
}

/**
 * Weekly score entry (shared across routes)
 */
export interface WeeklyScoreEntry {
  id: string;
  managerId: string;
  managerName: string;
  opponentId?: string;
  opponentName?: string;
  season: number;
  week: number;
  matchupId?: number;
  points: {
    for: number;
    against: number | null;
    optimal: number | null;
  };
  results: {
    h2hWin: boolean | null;
    medianWin: boolean | null;
    weeklyRank: number | null;
    allPlayWins: number | null;
    allPlayLosses: number | null;
  };
}

/**
 * Matchup data (shared across routes)
 */
export interface MatchupEntry {
  id: string;
  leagueId: string;
  season: number;
  week: number;
  matchupId: number;
  team1: {
    managerId: string;
    name: string;
    points: number;
  };
  team2: {
    managerId: string;
    name: string;
    points: number;
  };
  winner: {
    managerId: string | null;
    name: string;
  };
  pointDifferential: number;
  isPlayoff: boolean;
  isToiletBowl: boolean;
  playoffRound?: number;
}

/**
 * H2H record between two managers
 */
export interface H2HRecord {
  manager1: { id: string; name: string };
  manager2: { id: string; name: string };
  matchups: number;
  wins: number;
  losses: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  avgMargin: number;
}

/**
 * Streak information
 */
export interface StreakInfo {
  type: 'W' | 'L' | null;
  length: number;
  display: string;
}

/**
 * Manager career stats
 */
export interface CareerStats {
  totalWeeks: number;
  combined: RecordStats & { rank?: number };
  h2h: RecordStats;
  median: RecordStats;
  allPlay: RecordStats;
  points: PointsStats & { pfRank?: number; paRank?: number };
}
