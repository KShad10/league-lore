import type { Matchup } from '@/types/sleeper';

// ============================================
// CORE STAT COMPUTATION UTILITIES
// ============================================

/**
 * Group matchups by matchup_id to pair opponents
 */
export function pairMatchups(matchups: Matchup[]): Map<number, Matchup[]> {
  const pairs = new Map<number, Matchup[]>();

  for (const matchup of matchups) {
    const existing = pairs.get(matchup.matchupId) || [];
    existing.push(matchup);
    pairs.set(matchup.matchupId, existing);
  }

  return pairs;
}

/**
 * Calculate median value from array of numbers
 * For even-length arrays, returns average of two middle values
 */
export function calculateMedian(scores: number[]): number {
  if (scores.length === 0) return 0;

  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  // For even number of teams (10), median is average of 5th and 6th scores
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Calculate average value from array of numbers
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate standard deviation
 */
export function calculateStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = calculateAverage(values);
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = calculateAverage(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate all-play record for a single team in a week
 * Returns [wins, losses] against all other teams
 */
export function calculateAllPlay(
  teamScore: number,
  allScores: number[]
): { wins: number; losses: number } {
  let wins = 0;
  let losses = 0;
  
  for (const score of allScores) {
    if (score === teamScore) continue; // Skip self
    if (teamScore > score) {
      wins++;
    } else {
      losses++;
    }
  }
  
  return { wins, losses };
}

/**
 * Calculate weekly rank (1 = highest scorer)
 */
export function calculateWeeklyRank(teamScore: number, allScores: number[]): number {
  const sorted = [...allScores].sort((a, b) => b - a);
  return sorted.indexOf(teamScore) + 1;
}

/**
 * Process a week's matchups into structured results
 */
export interface WeekResult {
  rosterId: number;
  pointsFor: number;
  pointsAgainst: number;
  opponentRosterId: number;
  matchupId: number;
  h2hWin: boolean;
  medianWin: boolean;
  weeklyRank: number;
  allplayWins: number;
  allplayLosses: number;
}

export function processWeekMatchups(matchups: Matchup[]): WeekResult[] {
  if (matchups.length === 0) return [];
  
  // Get all scores for median/allplay calculations
  const allScores = matchups.map(m => m.points);
  const median = calculateMedian(allScores);
  
  // Pair matchups by matchup_id
  const pairs = pairMatchups(matchups);
  
  const results: WeekResult[] = [];
  
  for (const [matchupId, pair] of pairs) {
    if (pair.length !== 2) {
      console.warn(`Matchup ${matchupId} has ${pair.length} teams, expected 2`);
      continue;
    }
    
    const [team1, team2] = pair;
    
    // Team 1 result
    const team1AllPlay = calculateAllPlay(team1.points, allScores);
    results.push({
      rosterId: team1.rosterId,
      pointsFor: team1.points,
      pointsAgainst: team2.points,
      opponentRosterId: team2.rosterId,
      matchupId,
      h2hWin: team1.points > team2.points,
      medianWin: team1.points > median,
      weeklyRank: calculateWeeklyRank(team1.points, allScores),
      allplayWins: team1AllPlay.wins,
      allplayLosses: team1AllPlay.losses,
    });
    
    // Team 2 result
    const team2AllPlay = calculateAllPlay(team2.points, allScores);
    results.push({
      rosterId: team2.rosterId,
      pointsFor: team2.points,
      pointsAgainst: team1.points,
      opponentRosterId: team1.rosterId,
      matchupId,
      h2hWin: team2.points > team1.points,
      medianWin: team2.points > median,
      weeklyRank: calculateWeeklyRank(team2.points, allScores),
      allplayWins: team2AllPlay.wins,
      allplayLosses: team2AllPlay.losses,
    });
  }
  
  return results;
}

/**
 * Determine if a week is a playoff week based on league settings
 */
export function isPlayoffWeek(week: number, playoffWeekStart: number): boolean {
  return week >= playoffWeekStart;
}

// ============================================
// WEEK SUMMARY HELPERS
// ============================================

/**
 * Week summary statistics
 */
export interface WeekSummary {
  season: number;
  week: number;
  median: number;
  highest: number;
  lowest: number;
  average: number;
  topScorerId?: string;
  topScorerName?: string;
  bottomScorerId?: string;
  bottomScorerName?: string;
  teamsAboveMedian: number;
  teamsBelowMedian: number;
}

/**
 * Input for week summary calculation
 */
export interface WeekScoreInput {
  managerId: string;
  managerName: string;
  pointsFor: number;
}

/**
 * Calculate week summary from scores
 */
export function calculateWeekSummary(
  season: number,
  week: number,
  scores: WeekScoreInput[]
): WeekSummary {
  if (scores.length === 0) {
    return {
      season,
      week,
      median: 0,
      highest: 0,
      lowest: 0,
      average: 0,
      teamsAboveMedian: 0,
      teamsBelowMedian: 0,
    };
  }

  const points = scores.map(s => s.pointsFor);
  const median = calculateMedian(points);
  const highest = Math.max(...points);
  const lowest = Math.min(...points);
  const average = calculateAverage(points);

  const topScorer = scores.find(s => s.pointsFor === highest);
  const bottomScorer = scores.find(s => s.pointsFor === lowest);

  return {
    season,
    week,
    median,
    highest,
    lowest,
    average,
    topScorerId: topScorer?.managerId,
    topScorerName: topScorer?.managerName,
    bottomScorerId: bottomScorer?.managerId,
    bottomScorerName: bottomScorer?.managerName,
    teamsAboveMedian: scores.filter(s => s.pointsFor > median).length,
    teamsBelowMedian: scores.filter(s => s.pointsFor < median).length,
  };
}

// ============================================
// STANDINGS AGGREGATION
// ============================================

/**
 * Raw weekly score row from database
 */
export interface RawWeeklyScore {
  manager_id: string;
  season: number;
  week: number;
  points_for: number | string;
  points_against: number | string | null;
  h2h_win: boolean | null;
  median_win: boolean | null;
  allplay_wins: number | null;
  allplay_losses: number | null;
}

/**
 * Aggregated standing stats
 */
export interface AggregatedStats {
  managerId: string;
  season: number;
  h2hWins: number;
  h2hLosses: number;
  medianWins: number;
  medianLosses: number;
  allplayWins: number;
  allplayLosses: number;
  pointsFor: number;
  pointsAgainst: number;
  weeksPlayed: number;
}

/**
 * Aggregate weekly scores into standing stats
 */
export function aggregateStandings(
  scores: RawWeeklyScore[],
  usernameMap?: Map<string, string>
): Map<string, AggregatedStats> {
  const statsMap = new Map<string, AggregatedStats>();

  for (const row of scores) {
    const key = `${row.manager_id}-${row.season}`;
    const existing = statsMap.get(key);

    const pointsFor = typeof row.points_for === 'string'
      ? parseFloat(row.points_for)
      : row.points_for || 0;

    const pointsAgainst = typeof row.points_against === 'string'
      ? parseFloat(row.points_against)
      : row.points_against || 0;

    if (existing) {
      existing.h2hWins += row.h2h_win ? 1 : 0;
      existing.h2hLosses += row.h2h_win === false ? 1 : 0;
      existing.medianWins += row.median_win ? 1 : 0;
      existing.medianLosses += row.median_win === false ? 1 : 0;
      existing.allplayWins += row.allplay_wins || 0;
      existing.allplayLosses += row.allplay_losses || 0;
      existing.pointsFor += pointsFor;
      existing.pointsAgainst += pointsAgainst;
      existing.weeksPlayed += 1;
    } else {
      statsMap.set(key, {
        managerId: row.manager_id,
        season: row.season,
        h2hWins: row.h2h_win ? 1 : 0,
        h2hLosses: row.h2h_win === false ? 1 : 0,
        medianWins: row.median_win ? 1 : 0,
        medianLosses: row.median_win === false ? 1 : 0,
        allplayWins: row.allplay_wins || 0,
        allplayLosses: row.allplay_losses || 0,
        pointsFor,
        pointsAgainst,
        weeksPlayed: 1,
      });
    }
  }

  return statsMap;
}

/**
 * Calculate win percentage (0-100 scale)
 */
export function calculateWinPct(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0;
  return Math.round((wins / total) * 10000) / 100;
}

/**
 * Round to 2 decimal places
 */
export function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ============================================
// RANKING HELPERS
// ============================================

/**
 * Calculate ranks for an array of items by a numeric key
 */
export function calculateRanks<T extends Record<string, unknown>>(
  items: T[],
  getValue: (item: T) => number,
  ascending = false
): Map<T, number> {
  const sorted = [...items].sort((a, b) => {
    const aVal = getValue(a);
    const bVal = getValue(b);
    return ascending ? aVal - bVal : bVal - aVal;
  });

  const rankMap = new Map<T, number>();
  sorted.forEach((item, index) => {
    rankMap.set(item, index + 1);
  });

  return rankMap;
}

/**
 * Add ranks to an array based on a composite sort
 */
export function rankByComposite<T>(
  items: T[],
  compareFn: (a: T, b: T) => number
): (T & { rank: number })[] {
  const sorted = [...items].sort(compareFn);
  return sorted.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

// ============================================
// STREAK CALCULATION
// ============================================

/**
 * Streak type (Win or Loss)
 */
export type StreakType = 'W' | 'L' | null;

/**
 * Current streak info
 */
export interface CurrentStreak {
  type: StreakType;
  length: number;
  display: string;
}

/**
 * Calculate current streak from results
 * Results should be sorted newest first
 */
export function calculateCurrentStreak(results: (boolean | null)[]): CurrentStreak {
  const validResults = results.filter(r => r !== null) as boolean[];

  if (validResults.length === 0) {
    return { type: null, length: 0, display: '-' };
  }

  const firstResult = validResults[0];
  let count = 0;

  for (const result of validResults) {
    if (result === firstResult) {
      count++;
    } else {
      break;
    }
  }

  const type: StreakType = firstResult ? 'W' : 'L';
  return {
    type,
    length: count,
    display: `${count}${type}`,
  };
}
