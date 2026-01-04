import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ leagueId: string }>
}

interface StandingRow {
  managerId: string
  username: string
  displayName: string
  season: number
  h2hWins: number
  h2hLosses: number
  medianWins: number
  medianLosses: number
  allplayWins: number
  allplayLosses: number
  pointsFor: number
  pointsAgainst: number
  weeksPlayed: number
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params
  const { searchParams } = new URL(request.url)
  const seasonParam = searchParams.get('season')
  const includePlayoffs = searchParams.get('playoffs') === 'true'
  
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
    
    // Get league info
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('current_season, first_season')
      .eq('id', leagueId)
      .single()
    
    if (leagueError) {
      return NextResponse.json(
        { success: false, error: `League not found: ${leagueError.message}` },
        { status: 404 }
      )
    }
    
    // Get league settings history for playoff week starts
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
    
    // Query weekly scores with manager info
    let query = supabase
      .from('weekly_scores')
      .select(`
        manager_id,
        season,
        week,
        points_for,
        points_against,
        h2h_win,
        median_win,
        allplay_wins,
        allplay_losses,
        managers!weekly_scores_manager_id_fkey(current_username, display_name)
      `)
      .eq('league_id', leagueId)
    
    if (seasonParam) {
      query = query.eq('season', parseInt(seasonParam))
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
        season: seasonParam ? parseInt(seasonParam) : 'all',
        standings: [],
        message: 'No data found for this league'
      })
    }
    
    // Filter to regular season only if not including playoffs
    const filteredData = includePlayoffs 
      ? data 
      : data.filter(row => {
          const playoffStart = playoffStartMap.get(row.season) || 15
          return row.week < playoffStart
        })
    
    // Aggregate by manager and season
    const standingsMap = new Map<string, StandingRow>()
    
    for (const row of filteredData) {
      const key = `${row.manager_id}-${row.season}`
      const manager = row.managers as unknown as { current_username: string; display_name: string } | null
      const existing = standingsMap.get(key)
      
      if (existing) {
        existing.h2hWins += row.h2h_win ? 1 : 0
        existing.h2hLosses += row.h2h_win === false ? 1 : 0
        existing.medianWins += row.median_win ? 1 : 0
        existing.medianLosses += row.median_win === false ? 1 : 0
        existing.allplayWins += row.allplay_wins || 0
        existing.allplayLosses += row.allplay_losses || 0
        existing.pointsFor += parseFloat(String(row.points_for)) || 0
        existing.pointsAgainst += parseFloat(String(row.points_against)) || 0
        existing.weeksPlayed += 1
      } else {
        standingsMap.set(key, {
          managerId: row.manager_id,
          username: manager?.current_username || 'Unknown',
          displayName: manager?.display_name || manager?.current_username || 'Unknown',
          season: row.season,
          h2hWins: row.h2h_win ? 1 : 0,
          h2hLosses: row.h2h_win === false ? 1 : 0,
          medianWins: row.median_win ? 1 : 0,
          medianLosses: row.median_win === false ? 1 : 0,
          allplayWins: row.allplay_wins || 0,
          allplayLosses: row.allplay_losses || 0,
          pointsFor: parseFloat(String(row.points_for)) || 0,
          pointsAgainst: parseFloat(String(row.points_against)) || 0,
          weeksPlayed: 1,
        })
      }
    }
    
    // Convert to array
    const standingsArray = Array.from(standingsMap.values())
    
    // Calculate season ranks
    const seasonRanks = new Map<string, number>()
    const seasons = [...new Set(standingsArray.map(s => s.season))]
    
    for (const season of seasons) {
      const seasonStandings = standingsArray
        .filter(s => s.season === season)
        .sort((a, b) => {
          const aCombined = a.h2hWins + a.medianWins
          const bCombined = b.h2hWins + b.medianWins
          if (aCombined !== bCombined) return bCombined - aCombined
          return b.pointsFor - a.pointsFor
        })
      
      seasonStandings.forEach((s, index) => {
        seasonRanks.set(`${s.managerId}-${s.season}`, index + 1)
      })
    }
    
    // Build standings with derived stats
    const standings = standingsArray.map(row => ({
      managerId: row.managerId,
      displayName: row.displayName,
      username: row.username,
      season: row.season,
      record: {
        h2h: { wins: row.h2hWins, losses: row.h2hLosses },
        median: { wins: row.medianWins, losses: row.medianLosses },
        combined: { 
          wins: row.h2hWins + row.medianWins, 
          losses: row.h2hLosses + row.medianLosses 
        },
        allPlay: { wins: row.allplayWins, losses: row.allplayLosses },
      },
      points: {
        for: Math.round(row.pointsFor * 100) / 100,
        against: Math.round(row.pointsAgainst * 100) / 100,
        avgPerWeek: Math.round((row.pointsFor / row.weeksPlayed) * 100) / 100,
      },
      weeksPlayed: row.weeksPlayed,
      seasonRank: seasonRanks.get(`${row.managerId}-${row.season}`) || 0,
    }))
    
    // Sort by combined wins desc, then points for desc
    standings.sort((a, b) => {
      const aCombined = a.record.combined.wins
      const bCombined = b.record.combined.wins
      if (aCombined !== bCombined) return bCombined - aCombined
      return b.points.for - a.points.for
    })
    
    // Calculate ranks
    const sortedByPF = [...standings].sort((a, b) => b.points.for - a.points.for)
    const sortedByPA = [...standings].sort((a, b) => b.points.against - a.points.against)
    const sortedByAllPlay = [...standings].sort((a, b) => b.record.allPlay.wins - a.record.allPlay.wins)
    
    const pfRankMap = new Map(sortedByPF.map((s, i) => [`${s.managerId}-${s.season}`, i + 1]))
    const paRankMap = new Map(sortedByPA.map((s, i) => [`${s.managerId}-${s.season}`, i + 1]))
    const allPlayRankMap = new Map(sortedByAllPlay.map((s, i) => [`${s.managerId}-${s.season}`, i + 1]))
    
    // Add rankings
    const rankedStandings = standings.map((row, index) => ({
      ...row,
      rank: index + 1,
      points: {
        ...row.points,
        forRank: pfRankMap.get(`${row.managerId}-${row.season}`) || 0,
        againstRank: paRankMap.get(`${row.managerId}-${row.season}`) || 0,
      },
      record: {
        ...row.record,
        allPlay: {
          ...row.record.allPlay,
          rank: allPlayRankMap.get(`${row.managerId}-${row.season}`) || 0,
        },
      },
    }))
    
    const displaySeason = seasonParam ? parseInt(seasonParam) : league.current_season
    const playoffWeekStart = playoffStartMap.get(displaySeason) || 15
    
    return NextResponse.json({
      success: true,
      leagueId,
      season: seasonParam ? parseInt(seasonParam) : 'all',
      includePlayoffs,
      regularSeasonWeeks: playoffWeekStart - 1,
      playoffWeekStart,
      totalEntries: rankedStandings.length,
      seasons: seasons.sort((a, b) => b - a),
      standings: rankedStandings,
    })
    
  } catch (error) {
    console.error('Standings query failed:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
