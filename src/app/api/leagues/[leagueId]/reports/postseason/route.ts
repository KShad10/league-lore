import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  generatePostseasonReport, 
  PostseasonReportData, 
  PostseasonMatchup,
  BracketRound 
} from '@/lib/reports'

interface RouteParams {
  params: Promise<{ leagueId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params
  const { searchParams } = new URL(request.url)
  const season = searchParams.get('season')
  const format = searchParams.get('format') || 'html'
  
  if (!season) {
    return NextResponse.json(
      { success: false, error: 'Season parameter is required' },
      { status: 400 }
    )
  }
  
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
    
    // Fetch postseason data by calling the postseason endpoint logic directly
    // Get league settings
    const { data: settings } = await supabase
      .from('league_settings_history')
      .select('league_settings, scoring_settings')
      .eq('league_id', leagueId)
      .eq('season', parseInt(season))
      .single()
    
    const ls = settings?.league_settings || {}
    const playoffWeekStart = ls.playoff_week_start || settings?.scoring_settings?.playoff_week_start || 15
    const playoffTeams = ls.playoff_teams || 6
    const totalRosters = ls.total_rosters || 10
    
    // Get seedings from regular season
    const { data: standingsData } = await supabase
      .from('weekly_scores')
      .select(`
        manager_id,
        points_for,
        h2h_win,
        median_win,
        managers!weekly_scores_manager_id_fkey(current_username, display_name)
      `)
      .eq('league_id', leagueId)
      .eq('season', parseInt(season))
      .lt('week', playoffWeekStart)
    
    // Aggregate standings
    const managerStats = new Map<string, {
      managerId: string
      name: string
      combinedWins: number
      pointsFor: number
    }>()
    
    for (const row of (standingsData || [])) {
      const manager = row.managers as unknown as { current_username: string; display_name: string } | null
      const existing = managerStats.get(row.manager_id) || {
        managerId: row.manager_id,
        name: manager?.display_name || manager?.current_username || 'Unknown',
        combinedWins: 0,
        pointsFor: 0,
      }
      
      existing.combinedWins += (row.h2h_win ? 1 : 0) + (row.median_win ? 1 : 0)
      existing.pointsFor += parseFloat(row.points_for) || 0
      managerStats.set(row.manager_id, existing)
    }
    
    const sortedManagers = Array.from(managerStats.values()).sort((a, b) => {
      if (b.combinedWins !== a.combinedWins) return b.combinedWins - a.combinedWins
      return b.pointsFor - a.pointsFor
    })
    
    const seedMap = new Map<string, number>()
    sortedManagers.forEach((m, i) => seedMap.set(m.managerId, i + 1))
    
    const byeSeeds = playoffTeams === 6 ? [1, 2] : []
    
    const seedings = sortedManagers.map((m, i) => ({
      seed: i + 1,
      managerId: m.managerId,
      name: m.name,
      combinedWins: m.combinedWins,
      pointsFor: Math.round(m.pointsFor * 100) / 100,
      bracket: ((i + 1) <= playoffTeams ? 'playoff' : 'toilet_bowl') as 'playoff' | 'toilet_bowl',
      hasBye: byeSeeds.includes(i + 1),
    }))
    
    // Get playoff matchups
    const { data: matchups } = await supabase
      .from('matchups')
      .select(`
        *,
        team1:managers!matchups_team1_manager_id_fkey(current_username, display_name),
        team2:managers!matchups_team2_manager_id_fkey(current_username, display_name),
        winner:managers!matchups_winner_manager_id_fkey(current_username, display_name)
      `)
      .eq('league_id', leagueId)
      .eq('season', parseInt(season))
      .eq('is_playoff', true)
      .order('week', { ascending: true })
    
    // Process matchups into bracket structure with proper types
    const playoffBracket: Record<string, BracketRound> = {}
    const placeGames: Record<string, BracketRound> = {}
    const toiletBowl: Record<string, BracketRound> = {}
    
    let champion: string | null = null, championSeed = 0
    let runnerUp: string | null = null, runnerUpSeed = 0
    const thirdPlace: string | null = null, thirdPlaceSeed = 0
    let toiletBowlLoser: string | null = null, toiletBowlLoserSeed = 0
    
    for (const m of (matchups || [])) {
      const team1 = m.team1 as unknown as { display_name?: string; current_username?: string } | null
      const team2 = m.team2 as unknown as { display_name?: string; current_username?: string } | null
      const winner = m.winner as unknown as { display_name?: string; current_username?: string } | null
      
      const seed1 = seedMap.get(m.team1_manager_id) || 99
      const seed2 = seedMap.get(m.team2_manager_id) || 99
      const winnerSeed = seedMap.get(m.winner_manager_id) || 0
      
      const roundNumber = m.week - playoffWeekStart + 1
      const isLowerBracket = seed1 > playoffTeams && seed2 > playoffTeams
      
      // Determine matchup type and bracket type
      let matchupType = 'Playoff'
      let bracketType: 'playoff' | 'toilet_bowl' | 'place_game' = 'playoff'
      
      if (isLowerBracket) {
        bracketType = 'toilet_bowl'
        if (roundNumber === 1) matchupType = 'Toilet Bowl Round 1'
        else matchupType = 'Last Place'
      } else {
        bracketType = 'playoff'
        if (roundNumber === 1) matchupType = 'Wildcard'
        else if (roundNumber === 2) matchupType = 'Semifinal'
        else if (roundNumber === 3) matchupType = 'Championship'
      }
      
      const team1Name = team1?.display_name || team1?.current_username || 'Unknown'
      const team2Name = team2?.display_name || team2?.current_username || 'Unknown'
      const winnerName = winner?.display_name || winner?.current_username || 'TBD'
      const pointDiff = parseFloat(m.point_differential) || 0
      
      const formatted: PostseasonMatchup = {
        id: m.id,
        week: m.week,
        matchupType,
        bracketType,
        team1: {
          managerId: m.team1_manager_id,
          name: team1Name,
          seed: seed1,
          points: parseFloat(m.team1_points) || 0,
          isWinner: m.winner_manager_id === m.team1_manager_id,
        },
        team2: {
          managerId: m.team2_manager_id,
          name: team2Name,
          seed: seed2,
          points: parseFloat(m.team2_points) || 0,
          isWinner: m.winner_manager_id === m.team2_manager_id,
        },
        pointDifferential: pointDiff,
        winnerName,
        winnerSeed,
      }
      
      const weekKey = String(m.week)
      const target = isLowerBracket ? toiletBowl : playoffBracket
      
      if (!target[weekKey]) {
        target[weekKey] = { name: matchupType, week: m.week, matchups: [] }
      }
      target[weekKey].matchups.push(formatted)
      
      // Track outcomes
      if (matchupType === 'Championship' && m.winner_manager_id) {
        if (m.winner_manager_id === m.team1_manager_id) {
          champion = team1Name
          championSeed = seed1
          runnerUp = team2Name
          runnerUpSeed = seed2
        } else {
          champion = team2Name
          championSeed = seed2
          runnerUp = team1Name
          runnerUpSeed = seed1
        }
      }
      
      if (matchupType === 'Last Place' && m.winner_manager_id) {
        if (m.winner_manager_id === m.team1_manager_id) {
          toiletBowlLoser = team2Name
          toiletBowlLoserSeed = seed2
        } else {
          toiletBowlLoser = team1Name
          toiletBowlLoserSeed = seed1
        }
      }
    }
    
    const hasChampion = !!champion
    const hasToiletBowlLoser = !!toiletBowlLoser
    const isComplete = hasChampion && hasToiletBowlLoser
    
    // Build report data
    const reportData: PostseasonReportData = {
      season: parseInt(season),
      settings: {
        playoffWeekStart,
        playoffTeams,
        totalRosters,
        toiletBowlTeams: totalRosters - playoffTeams,
      },
      seedings,
      summary: {
        champion,
        championSeed,
        runnerUp,
        runnerUpSeed,
        thirdPlace,
        thirdPlaceSeed,
        toiletBowlLoser,
        toiletBowlLoserSeed,
      },
      playoff: { rounds: playoffBracket },
      placeGames: { rounds: placeGames },
      toiletBowl: { rounds: toiletBowl },
      isComplete,
    }
    
    // Return based on format
    if (format === 'json') {
      return NextResponse.json({ success: true, data: reportData })
    }
    
    // Generate HTML report
    const htmlReport = generatePostseasonReport(reportData)
    
    return new NextResponse(htmlReport, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
    
  } catch (error) {
    console.error('Postseason report generation failed:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
