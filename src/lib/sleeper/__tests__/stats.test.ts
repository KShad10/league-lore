/**
 * Tests for stat computation utilities
 *
 * Run with: npx vitest run src/lib/sleeper/__tests__/stats.test.ts
 * Or: npm test
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMedian,
  calculateAverage,
  calculateStdDev,
  calculateAllPlay,
  calculateWeeklyRank,
  pairMatchups,
  processWeekMatchups,
  isPlayoffWeek,
  calculateWeekSummary,
  aggregateStandings,
  calculateWinPct,
  roundTo2,
  calculateRanks,
  rankByComposite,
  calculateCurrentStreak,
  type WeekScoreInput,
  type RawWeeklyScore,
} from '../stats';
import type { Matchup } from '@/types/sleeper';

// ============================================
// MEDIAN TESTS
// ============================================

describe('calculateMedian', () => {
  it('should return 0 for empty array', () => {
    expect(calculateMedian([])).toBe(0);
  });

  it('should return the single value for array of one', () => {
    expect(calculateMedian([100])).toBe(100);
  });

  it('should return middle value for odd-length array', () => {
    expect(calculateMedian([1, 2, 3, 4, 5])).toBe(3);
    expect(calculateMedian([10, 50, 90])).toBe(50);
  });

  it('should return average of two middle values for even-length array', () => {
    expect(calculateMedian([1, 2, 3, 4])).toBe(2.5);
    expect(calculateMedian([100, 110, 120, 130])).toBe(115);
  });

  it('should handle unsorted arrays', () => {
    expect(calculateMedian([5, 1, 3, 2, 4])).toBe(3);
    expect(calculateMedian([130, 100, 110, 120])).toBe(115);
  });

  it('should handle 10-team league (typical fantasy)', () => {
    const scores = [150.5, 140.2, 135.8, 125.0, 120.5, 115.3, 110.8, 105.2, 98.6, 85.0];
    // Sorted: 85, 98.6, 105.2, 110.8, 115.3, 120.5, 125, 135.8, 140.2, 150.5
    // Middle two: 115.3, 120.5 -> average = 117.9
    expect(calculateMedian(scores)).toBeCloseTo(117.9, 1);
  });

  it('should not modify original array', () => {
    const original = [5, 1, 3, 2, 4];
    calculateMedian(original);
    expect(original).toEqual([5, 1, 3, 2, 4]);
  });
});

// ============================================
// AVERAGE TESTS
// ============================================

describe('calculateAverage', () => {
  it('should return 0 for empty array', () => {
    expect(calculateAverage([])).toBe(0);
  });

  it('should return the single value for array of one', () => {
    expect(calculateAverage([100])).toBe(100);
  });

  it('should calculate correct average', () => {
    expect(calculateAverage([10, 20, 30])).toBe(20);
    expect(calculateAverage([100, 110, 120, 130])).toBe(115);
  });

  it('should handle decimal values', () => {
    expect(calculateAverage([10.5, 20.5, 30.0])).toBeCloseTo(20.333, 2);
  });
});

// ============================================
// STANDARD DEVIATION TESTS
// ============================================

describe('calculateStdDev', () => {
  it('should return 0 for empty array', () => {
    expect(calculateStdDev([])).toBe(0);
  });

  it('should return 0 for single element', () => {
    expect(calculateStdDev([100])).toBe(0);
  });

  it('should return 0 for identical values', () => {
    expect(calculateStdDev([50, 50, 50, 50])).toBe(0);
  });

  it('should calculate correct standard deviation', () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] -> mean=5, stddev=2
    expect(calculateStdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 0);
  });
});

// ============================================
// ALL-PLAY TESTS
// ============================================

describe('calculateAllPlay', () => {
  it('should calculate wins against all other teams', () => {
    const allScores = [150, 140, 130, 120, 110, 100, 90, 80, 70, 60];

    // Highest scorer (150) beats everyone
    expect(calculateAllPlay(150, allScores)).toEqual({ wins: 9, losses: 0 });

    // Lowest scorer (60) loses to everyone
    expect(calculateAllPlay(60, allScores)).toEqual({ wins: 0, losses: 9 });

    // Middle scorer (110) beats 4, loses to 5
    expect(calculateAllPlay(110, allScores)).toEqual({ wins: 4, losses: 5 });
  });

  it('should skip self when calculating', () => {
    const allScores = [100, 100, 100];
    // With all same scores, should skip self and have 0 wins, 0 losses
    // Actually when tied, they count as losses in current implementation
    const result = calculateAllPlay(100, allScores);
    expect(result.wins + result.losses).toBe(2); // 2 other teams
  });

  it('should handle ties as losses', () => {
    const allScores = [100, 100, 90];
    const result = calculateAllPlay(100, allScores);
    expect(result.wins).toBe(1); // beats 90
    expect(result.losses).toBe(1); // ties with other 100
  });
});

// ============================================
// WEEKLY RANK TESTS
// ============================================

describe('calculateWeeklyRank', () => {
  it('should return 1 for highest scorer', () => {
    const allScores = [150, 140, 130, 120, 110];
    expect(calculateWeeklyRank(150, allScores)).toBe(1);
  });

  it('should return correct rank for middle scorer', () => {
    const allScores = [150, 140, 130, 120, 110];
    expect(calculateWeeklyRank(130, allScores)).toBe(3);
  });

  it('should return last place for lowest scorer', () => {
    const allScores = [150, 140, 130, 120, 110];
    expect(calculateWeeklyRank(110, allScores)).toBe(5);
  });

  it('should handle unsorted input', () => {
    const allScores = [110, 150, 130, 140, 120];
    expect(calculateWeeklyRank(150, allScores)).toBe(1);
    expect(calculateWeeklyRank(110, allScores)).toBe(5);
  });
});

// ============================================
// PAIR MATCHUPS TESTS
// ============================================

describe('pairMatchups', () => {
  it('should group matchups by matchupId', () => {
    const matchups: Matchup[] = [
      { rosterId: 1, matchupId: 1, points: 100, starters: [], startersPoints: [], players: [], playersPoints: {} },
      { rosterId: 2, matchupId: 1, points: 95, starters: [], startersPoints: [], players: [], playersPoints: {} },
      { rosterId: 3, matchupId: 2, points: 110, starters: [], startersPoints: [], players: [], playersPoints: {} },
      { rosterId: 4, matchupId: 2, points: 105, starters: [], startersPoints: [], players: [], playersPoints: {} },
    ];

    const pairs = pairMatchups(matchups);

    expect(pairs.size).toBe(2);
    expect(pairs.get(1)?.length).toBe(2);
    expect(pairs.get(2)?.length).toBe(2);
  });

  it('should return empty map for empty input', () => {
    const pairs = pairMatchups([]);
    expect(pairs.size).toBe(0);
  });
});

// ============================================
// PROCESS WEEK MATCHUPS TESTS
// ============================================

describe('processWeekMatchups', () => {
  it('should process matchups and calculate all stats', () => {
    const matchups: Matchup[] = [
      { rosterId: 1, matchupId: 1, points: 120, starters: [], startersPoints: [], players: [], playersPoints: {} },
      { rosterId: 2, matchupId: 1, points: 100, starters: [], startersPoints: [], players: [], playersPoints: {} },
      { rosterId: 3, matchupId: 2, points: 115, starters: [], startersPoints: [], players: [], playersPoints: {} },
      { rosterId: 4, matchupId: 2, points: 110, starters: [], startersPoints: [], players: [], playersPoints: {} },
    ];

    const results = processWeekMatchups(matchups);

    expect(results.length).toBe(4);

    // Check team 1 (highest scorer, 120)
    const team1 = results.find(r => r.rosterId === 1);
    expect(team1).toBeDefined();
    expect(team1?.h2hWin).toBe(true);
    expect(team1?.weeklyRank).toBe(1);
    expect(team1?.allplayWins).toBe(3);
    expect(team1?.allplayLosses).toBe(0);

    // Check team 2 (lowest scorer, 100)
    const team2 = results.find(r => r.rosterId === 2);
    expect(team2).toBeDefined();
    expect(team2?.h2hWin).toBe(false);
    expect(team2?.weeklyRank).toBe(4);
    expect(team2?.allplayWins).toBe(0);
    expect(team2?.allplayLosses).toBe(3);
  });

  it('should calculate median wins correctly', () => {
    const matchups: Matchup[] = [
      { rosterId: 1, matchupId: 1, points: 120, starters: [], startersPoints: [], players: [], playersPoints: {} },
      { rosterId: 2, matchupId: 1, points: 100, starters: [], startersPoints: [], players: [], playersPoints: {} },
      { rosterId: 3, matchupId: 2, points: 115, starters: [], startersPoints: [], players: [], playersPoints: {} },
      { rosterId: 4, matchupId: 2, points: 105, starters: [], startersPoints: [], players: [], playersPoints: {} },
    ];
    // Median of [100, 105, 115, 120] = 110

    const results = processWeekMatchups(matchups);

    // Team 1 (120) > 110 median
    expect(results.find(r => r.rosterId === 1)?.medianWin).toBe(true);
    // Team 2 (100) < 110 median
    expect(results.find(r => r.rosterId === 2)?.medianWin).toBe(false);
    // Team 3 (115) > 110 median
    expect(results.find(r => r.rosterId === 3)?.medianWin).toBe(true);
    // Team 4 (105) < 110 median
    expect(results.find(r => r.rosterId === 4)?.medianWin).toBe(false);
  });

  it('should return empty array for empty input', () => {
    expect(processWeekMatchups([])).toEqual([]);
  });
});

// ============================================
// PLAYOFF WEEK TESTS
// ============================================

describe('isPlayoffWeek', () => {
  it('should return false for regular season weeks', () => {
    expect(isPlayoffWeek(1, 15)).toBe(false);
    expect(isPlayoffWeek(14, 15)).toBe(false);
  });

  it('should return true for playoff weeks', () => {
    expect(isPlayoffWeek(15, 15)).toBe(true);
    expect(isPlayoffWeek(16, 15)).toBe(true);
    expect(isPlayoffWeek(17, 15)).toBe(true);
  });

  it('should work with different playoff start weeks', () => {
    expect(isPlayoffWeek(14, 14)).toBe(true);
    expect(isPlayoffWeek(13, 14)).toBe(false);
  });
});

// ============================================
// WEEK SUMMARY TESTS
// ============================================

describe('calculateWeekSummary', () => {
  it('should calculate week summary stats', () => {
    const scores: WeekScoreInput[] = [
      { managerId: '1', managerName: 'Team A', pointsFor: 150 },
      { managerId: '2', managerName: 'Team B', pointsFor: 130 },
      { managerId: '3', managerName: 'Team C', pointsFor: 110 },
      { managerId: '4', managerName: 'Team D', pointsFor: 90 },
    ];

    const summary = calculateWeekSummary(2024, 5, scores);

    expect(summary.season).toBe(2024);
    expect(summary.week).toBe(5);
    expect(summary.highest).toBe(150);
    expect(summary.lowest).toBe(90);
    expect(summary.median).toBe(120); // (110 + 130) / 2
    expect(summary.average).toBeCloseTo(120, 0);
    expect(summary.topScorerName).toBe('Team A');
    expect(summary.bottomScorerName).toBe('Team D');
    expect(summary.teamsAboveMedian).toBe(2); // 150, 130
    expect(summary.teamsBelowMedian).toBe(2); // 110, 90
  });

  it('should handle empty scores', () => {
    const summary = calculateWeekSummary(2024, 1, []);

    expect(summary.median).toBe(0);
    expect(summary.highest).toBe(0);
    expect(summary.lowest).toBe(0);
    expect(summary.teamsAboveMedian).toBe(0);
    expect(summary.teamsBelowMedian).toBe(0);
  });
});

// ============================================
// AGGREGATE STANDINGS TESTS
// ============================================

describe('aggregateStandings', () => {
  it('should aggregate multiple weeks into standings', () => {
    const scores: RawWeeklyScore[] = [
      { manager_id: 'A', season: 2024, week: 1, points_for: 100, points_against: 90, h2h_win: true, median_win: true, allplay_wins: 9, allplay_losses: 0 },
      { manager_id: 'A', season: 2024, week: 2, points_for: 110, points_against: 120, h2h_win: false, median_win: true, allplay_wins: 7, allplay_losses: 2 },
      { manager_id: 'B', season: 2024, week: 1, points_for: 90, points_against: 100, h2h_win: false, median_win: false, allplay_wins: 2, allplay_losses: 7 },
      { manager_id: 'B', season: 2024, week: 2, points_for: 120, points_against: 110, h2h_win: true, median_win: true, allplay_wins: 8, allplay_losses: 1 },
    ];

    const standings = aggregateStandings(scores);

    expect(standings.size).toBe(2);

    const teamA = standings.get('A-2024');
    expect(teamA).toBeDefined();
    expect(teamA?.h2hWins).toBe(1);
    expect(teamA?.h2hLosses).toBe(1);
    expect(teamA?.medianWins).toBe(2);
    expect(teamA?.medianLosses).toBe(0);
    expect(teamA?.allplayWins).toBe(16);
    expect(teamA?.allplayLosses).toBe(2);
    expect(teamA?.pointsFor).toBe(210);
    expect(teamA?.weeksPlayed).toBe(2);
  });

  it('should handle string points values', () => {
    const scores: RawWeeklyScore[] = [
      { manager_id: 'A', season: 2024, week: 1, points_for: '100.50', points_against: '90.25', h2h_win: true, median_win: true, allplay_wins: 9, allplay_losses: 0 },
    ];

    const standings = aggregateStandings(scores);
    const teamA = standings.get('A-2024');

    expect(teamA?.pointsFor).toBeCloseTo(100.5, 2);
    expect(teamA?.pointsAgainst).toBeCloseTo(90.25, 2);
  });
});

// ============================================
// WIN PERCENTAGE TESTS
// ============================================

describe('calculateWinPct', () => {
  it('should return 0 for no games', () => {
    expect(calculateWinPct(0, 0)).toBe(0);
  });

  it('should return 100 for all wins', () => {
    expect(calculateWinPct(10, 0)).toBe(100);
  });

  it('should return 0 for all losses', () => {
    expect(calculateWinPct(0, 10)).toBe(0);
  });

  it('should return 50 for equal wins and losses', () => {
    expect(calculateWinPct(5, 5)).toBe(50);
  });

  it('should calculate correct percentage', () => {
    expect(calculateWinPct(7, 3)).toBe(70);
    expect(calculateWinPct(3, 7)).toBe(30);
  });
});

// ============================================
// ROUND TESTS
// ============================================

describe('roundTo2', () => {
  it('should round to 2 decimal places', () => {
    expect(roundTo2(100.1234)).toBe(100.12);
    expect(roundTo2(100.1256)).toBe(100.13);
    expect(roundTo2(100)).toBe(100);
  });
});

// ============================================
// RANKING TESTS
// ============================================

describe('calculateRanks', () => {
  it('should rank items by value descending', () => {
    const items = [
      { name: 'A', score: 100 },
      { name: 'B', score: 150 },
      { name: 'C', score: 75 },
    ];

    const ranks = calculateRanks(items, item => item.score);

    expect(ranks.get(items[0])).toBe(2); // A: 100
    expect(ranks.get(items[1])).toBe(1); // B: 150
    expect(ranks.get(items[2])).toBe(3); // C: 75
  });

  it('should rank items ascending when specified', () => {
    const items = [
      { name: 'A', score: 100 },
      { name: 'B', score: 150 },
      { name: 'C', score: 75 },
    ];

    const ranks = calculateRanks(items, item => item.score, true);

    expect(ranks.get(items[0])).toBe(2); // A: 100
    expect(ranks.get(items[1])).toBe(3); // B: 150
    expect(ranks.get(items[2])).toBe(1); // C: 75
  });
});

describe('rankByComposite', () => {
  it('should add ranks based on custom comparator', () => {
    const items = [
      { name: 'A', wins: 10, pf: 1000 },
      { name: 'B', wins: 10, pf: 1100 },
      { name: 'C', wins: 8, pf: 1200 },
    ];

    const ranked = rankByComposite(items, (a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pf - a.pf;
    });

    expect(ranked[0].name).toBe('B'); // 10 wins, 1100 PF
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].name).toBe('A'); // 10 wins, 1000 PF
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].name).toBe('C'); // 8 wins
    expect(ranked[2].rank).toBe(3);
  });
});

// ============================================
// STREAK TESTS
// ============================================

describe('calculateCurrentStreak', () => {
  it('should return win streak for consecutive wins', () => {
    const results = [true, true, true, false, true];
    const streak = calculateCurrentStreak(results);

    expect(streak.type).toBe('W');
    expect(streak.length).toBe(3);
    expect(streak.display).toBe('3W');
  });

  it('should return loss streak for consecutive losses', () => {
    const results = [false, false, true, true];
    const streak = calculateCurrentStreak(results);

    expect(streak.type).toBe('L');
    expect(streak.length).toBe(2);
    expect(streak.display).toBe('2L');
  });

  it('should handle null values', () => {
    const results = [null, true, true, false];
    const streak = calculateCurrentStreak(results);

    expect(streak.type).toBe('W');
    expect(streak.length).toBe(2);
  });

  it('should return no streak for empty array', () => {
    const streak = calculateCurrentStreak([]);

    expect(streak.type).toBe(null);
    expect(streak.length).toBe(0);
    expect(streak.display).toBe('-');
  });

  it('should return no streak for all nulls', () => {
    const streak = calculateCurrentStreak([null, null, null]);

    expect(streak.type).toBe(null);
    expect(streak.length).toBe(0);
  });
});
