import type { Matchup } from '@/types/sleeper';

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
 * Calculate weekly median score
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
