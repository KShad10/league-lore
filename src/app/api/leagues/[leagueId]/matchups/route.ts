import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ leagueId: string }>
}

function getPlayoffMatchupType(
  week: number,
  playoffWeekStart: number,
  isToiletBowl: boolean,
  playoffRound: number | null
): string {
  const round = playoffRound || (week - playoffWeekStart + 1)
  
  if (isToiletBowl) {
    if (round === 1) return 'Toilet Bowl Rd 1'
    if (round === 2) return 'Toilet Bowl Rd 2'
    if (round === 3) return 'Toilet Bowl Final'
    return `Toilet Bowl Rd ${round}`
  }
  
  if (round === 1) return 'Playoff Quarterfinal'
  if (round === 2) return 'Playoff Semifinal'
  if (round === 3) return 'Championship'
  return `Playoff Rd ${round}`
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params
  const { searchParams } = new URL(request.url)
  const season = searchParams.get('season')
  const week = searchParams.get('week')
  const playoffOnly = searchParams.get('playoff') === 'true'
  
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get league settings for playoff week starts
    const { data: settingsHistory } = await supabase
      .from('league_settings_history')
      .select('season, scoring_settings')
      .eq('league_id', leagueId)
    
    const playoffStartMap = new Map<number, number>()
    if (settingsHistory) {
      for (const settings of settingsHistory) {
        const playoffStart = settings.scoring_settings?.playoff_week_start || 15
        playoffStartMap.set(settings.season, playoffStart)
      }
    }
    
    // Build query
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
      .order('matchup_id', { ascending: true })
    
    if (season) {
      query = query.eq('season', parseInt(season))
    }
    if (week) {
      query = query.eq('week', parseInt(week))
    }
    if (playoffOnly) {
      query = query.eq('is_playoff', true)
    }
    
    const { data, error } = await query
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }
    
    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        leagueId,
        matchups: [],
        summary: { totalMatchups: 0 }
      })
    }
    
    // Transform to cleaner format
    const matchups = data.map(row => {
      const playoffWeekStart = playoffStartMap.get(row.season) || 15
      const isPlayoff = row.is_playoff
      const isToiletBowl = row.is_toilet_bowl || false
      
      let matchupTypeLabel = 'Regular Season'
      if (isPlayoff) {
        matchupTypeLabel = getPlayoffMatchupType(
          row.week,
          playoffWeekStart,
          isToiletBowl,
          row.playoff_round
        )
      }
      
      return {
        id: row.id,
        season: row.season,
        week: row.week,
        matchupId: row.matchup_id,
        team1: {
          managerId: row.team1_manager_id,
          name: row.team1?.display_name || row.team1?.current_username,
          points: parseFloat(String(row.team1_points)),
        },
        team2: {
          managerId: row.team2_manager_id,
          name: row.team2?.display_name || row.team2?.current_username,
          points: parseFloat(String(row.team2_points)),
        },
        winner: {
          managerId: row.winner_manager_id,
          name: row.winner?.display_name || row.winner?.current_username,
        },
        pointDifferential: parseFloat(String(row.point_differential)),
        isPlayoff: row.is_playoff,
        isToiletBowl: isToiletBowl,
        playoffRound: row.playoff_round,
        matchupType: matchupTypeLabel,
        isCloseGame: parseFloat(String(row.point_differential)) < 10,
        isBlowout: parseFloat(String(row.point_differential)) > 40,
      }
    })
    
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
    }
    
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
    })
    
  } catch (error) {
    console.error('Matchups query failed:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
