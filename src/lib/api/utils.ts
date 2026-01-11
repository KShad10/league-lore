// ============================================
// SHARED API UTILITIES
// ============================================

import { NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type {
  AuthContext,
  PlayoffStartMap,
  ManagerJoinResult,
  ApiErrorResponse,
} from './types';

// ============================================
// ERROR CODES
// ============================================

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ============================================
// ERROR RESPONSE HELPERS
// ============================================

/**
 * Create a standardized error response
 */
export function errorResponse(
  message: string,
  status: number,
  code?: ErrorCode,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    success: false,
    error: message,
  };

  if (code) body.code = code;
  if (details) body.details = details;

  return NextResponse.json(body, { status });
}

/**
 * 401 Unauthorized response
 */
export function unauthorizedResponse(message = 'Unauthorized'): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 401, ErrorCodes.UNAUTHORIZED);
}

/**
 * 404 Not Found response
 */
export function notFoundResponse(resource: string): NextResponse<ApiErrorResponse> {
  return errorResponse(`${resource} not found`, 404, ErrorCodes.NOT_FOUND);
}

/**
 * 400 Bad Request response
 */
export function badRequestResponse(message: string): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 400, ErrorCodes.BAD_REQUEST);
}

/**
 * 500 Internal Server Error response
 */
export function internalErrorResponse(
  error: unknown,
  context?: string
): NextResponse<ApiErrorResponse> {
  const message = error instanceof Error ? error.message : String(error);
  const fullMessage = context ? `${context}: ${message}` : message;

  // Log the error for debugging
  console.error(`[API Error]${context ? ` ${context}:` : ''}`, error);

  return errorResponse(fullMessage, 500, ErrorCodes.INTERNAL_ERROR);
}

/**
 * Database error response
 */
export function databaseErrorResponse(
  error: { message: string; code?: string },
  operation?: string
): NextResponse<ApiErrorResponse> {
  const message = operation
    ? `${operation} failed: ${error.message}`
    : error.message;

  console.error('[Database Error]', operation, error);

  return errorResponse(message, 500, ErrorCodes.DATABASE_ERROR, {
    pgCode: error.code,
  });
}

// ============================================
// SUCCESS RESPONSE HELPERS
// ============================================

/**
 * Create a standardized success response
 */
export function successResponse<T extends Record<string, unknown>>(
  data: T,
  status = 200
): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status });
}

// ============================================
// AUTHENTICATION
// ============================================

/**
 * Verify user authentication and return context
 * Returns null if not authenticated
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    userId: user.id,
    supabase,
  };
}

/**
 * Require authentication - throws error response if not authenticated
 */
export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuthContext();

  if (!context) {
    throw unauthorizedResponse();
  }

  return context;
}

/**
 * Higher-order function to wrap route handlers with auth
 */
export function withAuth<T>(
  handler: (context: AuthContext, ...args: T[]) => Promise<NextResponse>
): (...args: T[]) => Promise<NextResponse> {
  return async (...args: T[]) => {
    try {
      const context = await requireAuth();
      return handler(context, ...args);
    } catch (error) {
      if (error instanceof NextResponse) {
        return error;
      }
      return internalErrorResponse(error, 'Authentication');
    }
  };
}

// ============================================
// LEAGUE DATA HELPERS
// ============================================

/**
 * Get league info by ID
 */
export async function getLeague(
  supabase: SupabaseClient,
  leagueId: string
): Promise<{
  id: string;
  currentSeason: number;
  firstSeason: number;
} | null> {
  const { data, error } = await supabase
    .from('leagues')
    .select('id, current_season, first_season')
    .eq('id', leagueId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    currentSeason: data.current_season,
    firstSeason: data.first_season,
  };
}

/**
 * Get playoff week start map for all seasons
 */
export async function getPlayoffStartMap(
  supabase: SupabaseClient,
  leagueId: string
): Promise<PlayoffStartMap> {
  const { data: settingsHistory } = await supabase
    .from('league_settings_history')
    .select('season, scoring_settings, league_settings')
    .eq('league_id', leagueId);

  const playoffStartMap: PlayoffStartMap = new Map();

  if (settingsHistory) {
    for (const settings of settingsHistory) {
      const playoffStart =
        settings.league_settings?.playoff_week_start ||
        settings.scoring_settings?.playoff_week_start ||
        15;
      playoffStartMap.set(settings.season, playoffStart);
    }
  }

  return playoffStartMap;
}

/**
 * Get playoff week start for a specific season
 */
export async function getPlayoffWeekStart(
  supabase: SupabaseClient,
  leagueId: string,
  season: number
): Promise<number> {
  const { data: settings } = await supabase
    .from('league_settings_history')
    .select('scoring_settings, league_settings')
    .eq('league_id', leagueId)
    .eq('season', season)
    .single();

  return (
    settings?.league_settings?.playoff_week_start ||
    settings?.scoring_settings?.playoff_week_start ||
    15
  );
}

/**
 * Filter scores to regular season only
 */
export function filterRegularSeason<T extends { season: number; week: number }>(
  scores: T[],
  playoffStartMap: PlayoffStartMap
): T[] {
  return scores.filter(row => {
    const playoffStart = playoffStartMap.get(row.season) || 15;
    return row.week < playoffStart;
  });
}

// ============================================
// MANAGER HELPERS
// ============================================

/**
 * Get all managers for a league with id -> name mapping
 */
export async function getManagerNameMap(
  supabase: SupabaseClient,
  leagueId: string
): Promise<Map<string, string>> {
  const { data: managers } = await supabase
    .from('managers')
    .select('id, current_username, display_name')
    .eq('league_id', leagueId);

  const nameMap = new Map<string, string>();

  if (managers) {
    for (const m of managers) {
      nameMap.set(m.id, m.display_name || m.current_username);
    }
  }

  return nameMap;
}

/**
 * Extract manager name from Supabase join result
 */
export function extractManagerName(
  manager: ManagerJoinResult | null | unknown
): string {
  if (!manager || typeof manager !== 'object') return 'Unknown';
  const m = manager as ManagerJoinResult;
  return m.display_name || m.current_username || 'Unknown';
}

// ============================================
// QUERY PARAMETER HELPERS
// ============================================

/**
 * Parse season from search params
 */
export function parseSeason(searchParams: URLSearchParams): number | null {
  const season = searchParams.get('season');
  return season ? parseInt(season, 10) : null;
}

/**
 * Parse week from search params
 */
export function parseWeek(searchParams: URLSearchParams): number | null {
  const week = searchParams.get('week');
  return week ? parseInt(week, 10) : null;
}

/**
 * Parse boolean from search params
 */
export function parseBoolean(
  searchParams: URLSearchParams,
  key: string,
  defaultValue = false
): boolean {
  const value = searchParams.get(key);
  if (value === null) return defaultValue;
  return value === 'true' || value === '1';
}

/**
 * Parse pagination params
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaults = { limit: 100, offset: 0 }
): { limit: number; offset: number } {
  const limit = searchParams.get('limit');
  const offset = searchParams.get('offset');

  return {
    limit: limit ? Math.min(parseInt(limit, 10), 1000) : defaults.limit,
    offset: offset ? parseInt(offset, 10) : defaults.offset,
  };
}

// ============================================
// NUMBER FORMATTING
// ============================================

/**
 * Round to specified decimal places
 */
export function round(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate win percentage
 */
export function winPct(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0;
  return round((wins / total) * 100, 2);
}

/**
 * Parse numeric value from database (handles string/number)
 */
export function parseNumeric(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}
