import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

/**
 * Generate a descriptive label for playoff matchups
 */
function getPlayoffMatchupType(
  week: number,
  playoffWeekStart: number,
  isToiletBowl: boolean,
  playoffRound: number | null
): string {
  const round = playoffRound || (week - playoffWeekStart + 1);
  
  if (isToiletBowl) {
    if (round === 1) return 'Toilet Bowl Rd 1';
    if (round === 2) return 'Toilet Bowl Rd 2';
    if (round === 3) return 'Toilet Bowl Final';
    return `Toilet Bowl Rd ${round}`;
  }
  
  // Regular playoff bracket
  if (round === 1) return 'Playoff Quarterfinal';
  if (round === 2) return 'Playoff Semifinal';
  if (round === 3) return 'Championship';
  return `Playoff Rd ${round}`;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params;
  const { searchParams } = new URL(request.url);
  const season = searchParams.get('season');
  const week = searchParams.get('week');
  const playoffOnly = searchParams.get('playoff') === 'true';
  
  try {
    // Get league settings for playoff week starts
    const { data: settingsHistory } = await supabase
      .from('league_settings_history')
      .select('season, league_settings, scoring_settings')
      .eq('league_id', leagueId);
    
    const playoffStartMap = new Map<number, number>();
    if (settingsHistory) {
      for (const settings of settingsHistory) {
        const playoffStart = 
          settings.league_settings?.playoff_week_start ||
          settings.scoring_settings?.playoff_week_start ||
          15;
        playoffStartMap.set(settings.season, playoffStart);
      }
    }
    
    // Build query with explicit foreign key hints
    let query = supabase
      .from('matchups')
      .select(`
        *,
        team1:managers!matchups_team1_manager_id_fkey(current_username, display_name),
        team2:managers!matchups_team2_manager_id_fkey(current_username, display_name),
        winner:managers!matchups_winner_manager_id_fkey(current_username, display_name)
      `)
      .eq('league_id', leagueId)
      .order('season', { ascending: false })
      .order('week', { ascending: false })
      .order('matchup_id', { ascending: true });
    
    if (season) {
      query = query.eq('season', parseInt(season));
    }
    if (week) {
      query = query.eq('week', parseInt(week));
    }
    if (playoffOnly) {
      query = query.eq('is_playoff', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    // Transform to cleaner format with detailed playoff types
    const matchups = data.map(row => {
      const playoffWeekStart = playoffStartMap.get(row.season) || 15;
      const isPlayoff = row.is_playoff;
      const isToiletBowl = row.is_toilet_bowl || false;
      
      let matchupTypeLabel = 'Regular Season';
      if (isPlayoff) {
        matchupTypeLabel = getPlayoffMatchupType(
          row.week,
          playoffWeekStart,
          isToiletBowl,
          row.playoff_round
        );
      }
      
      return {
        id: row.id,
        season: row.season,
        week: row.week,
        matchupId: row.matchup_id,
        team1: {
          managerId: row.team1_manager_id,
          name: row.team1?.display_name || row.team1?.current_username,
          points: parseFloat(row.team1_points),
        },
        team2: {
          managerId: row.team2_manager_id,
          name: row.team2?.display_name || row.team2?.current_username,
          points: parseFloat(row.team2_points),
        },
        winner: {
          managerId: row.winner_manager_id,
          name: row.winner?.display_name || row.winner?.current_username,
        },
        pointDifferential: parseFloat(row.point_differential),
        isPlayoff: row.is_playoff,
        isToiletBowl: isToiletBowl,
        playoffRound: row.playoff_round,
        matchupType: matchupTypeLabel,
        isCloseGame: parseFloat(row.point_differential) < 10,
        isBlowout: parseFloat(row.point_differential) > 40,
      };
    });
    
    // Calculate summary stats
    const summary = {
      totalMatchups: matchups.length,
      regularSeason: matchups.filter(m => !m.isPlayoff).length,
      playoffs: matchups.filter(m => m.isPlayoff && !m.isToiletBowl).length,
      toiletBowl: matchups.filter(m => m.isToiletBowl).length,
      closeGames: matchups.filter(m => m.isCloseGame).length,
      blowouts: matchups.filter(m => m.isBlowout).length,
      avgPointDiff: matchups.length > 0
        ? Math.round(matchups.reduce((sum, m) => sum + m.pointDifferential, 0) / matchups.length * 100) / 100
        : 0,
      biggestBlowout: matchups.length > 0
        ? matchups.reduce((max, m) => m.pointDifferential > max.pointDifferential ? m : max)
        : null,
      closestGame: matchups.length > 0
        ? matchups.reduce((min, m) => m.pointDifferential < min.pointDifferential ? m : min)
        : null,
    };
    
    return NextResponse.json({
      success: true,
      leagueId,
      filters: {
        season: season ? parseInt(season) : 'all',
        week: week ? parseInt(week) : 'all',
        playoffOnly,
      },
      summary,
      matchups,
    });
    
  } catch (error) {
    console.error('Matchups query failed:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
