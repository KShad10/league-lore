import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params;
  const { searchParams } = new URL(request.url);
  const season = searchParams.get('season');
  const week = searchParams.get('week');
  const managerId = searchParams.get('managerId');
  
  try {
    // Build query with explicit foreign key hints
    let query = supabase
      .from('weekly_scores')
      .select(`
        *,
        manager:managers!weekly_scores_manager_id_fkey(current_username, display_name),
        opponent:managers!weekly_scores_opponent_id_fkey(current_username, display_name)
      `)
      .eq('league_id', leagueId)
      .order('season', { ascending: true })
      .order('week', { ascending: true })
      .order('weekly_rank', { ascending: true });
    
    if (season) {
      query = query.eq('season', parseInt(season));
    }
    if (week) {
      query = query.eq('week', parseInt(week));
    }
    if (managerId) {
      query = query.eq('manager_id', managerId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    // Transform to cleaner format
    const scores = data.map(row => ({
      id: row.id,
      managerId: row.manager_id,
      managerName: row.manager?.display_name || row.manager?.current_username,
      opponentId: row.opponent_id,
      opponentName: row.opponent?.display_name || row.opponent?.current_username,
      season: row.season,
      week: row.week,
      matchupId: row.matchup_id,
      points: {
        for: parseFloat(row.points_for),
        against: row.points_against ? parseFloat(row.points_against) : null,
        optimal: row.optimal_points ? parseFloat(row.optimal_points) : null,
      },
      results: {
        h2hWin: row.h2h_win,
        medianWin: row.median_win,
        weeklyRank: row.weekly_rank,
        allPlayWins: row.allplay_wins,
        allPlayLosses: row.allplay_losses,
      },
    }));
    
    // Calculate summary stats if filtering by week
    let summary = null;
    if (week && season) {
      const weekScores = scores.map(s => s.points.for);
      const median = calculateMedian(weekScores);
      const highest = Math.max(...weekScores);
      const lowest = Math.min(...weekScores);
      const topScorer = scores.find(s => s.points.for === highest);
      const bottomScorer = scores.find(s => s.points.for === lowest);
      
      summary = {
        season: parseInt(season),
        week: parseInt(week),
        median,
        highest,
        lowest,
        topScorer: topScorer?.managerName,
        bottomScorer: bottomScorer?.managerName,
        teamsAboveMedian: scores.filter(s => s.points.for > median).length,
        teamsBelowMedian: scores.filter(s => s.points.for < median).length,
      };
    }
    
    return NextResponse.json({
      success: true,
      leagueId,
      filters: {
        season: season ? parseInt(season) : 'all',
        week: week ? parseInt(week) : 'all',
        managerId: managerId || 'all',
      },
      count: scores.length,
      summary,
      scores,
    });
    
  } catch (error) {
    console.error('Weekly scores query failed:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}
