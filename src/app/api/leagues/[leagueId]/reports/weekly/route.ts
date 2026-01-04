import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateWeeklyReport, WeeklyReportData } from '@/lib/reports'

interface RouteParams {
  params: Promise<{ leagueId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params
  const { searchParams } = new URL(request.url)
  const season = searchParams.get('season')
  const week = searchParams.get('week')
  const format = searchParams.get('format') || 'html'
  
  if (!season || !week) {
    return NextResponse.json(
      { success: false, error: 'Season and week parameters are required' },
      { status: 400 }
    )
  }
  
  const seasonNum = parseInt(season)
  const weekNum = parseInt(week)
  
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
    
    // Get league settings
    const { data: settings } = await supabase
      .from('league_settings_history')
      .select('league_settings')
      .eq('league_id', leagueId)
      .eq('season', seasonNum)
      .single()
    
    const playoffWeekStart = settings?.league_settings?.playoff_week_start || 15
    
    // Get matchups for the week
    const { data: matchups, error: matchupsError } = await supabase
      .from('matchups')
      .select(`
        *,
        team1:managers!matchups_team1_manager_id_fkey(id, current_username, display_name),
        team2:managers!matchups_team2_manager_id_fkey(id, current_username, display_name),
        winner:managers!matchups_winner_manager_id_fkey(id, current_username, display_name)
      `)
      .eq('league_id', leagueId)
      .eq('season', seasonNum)
      .eq('week', weekNum)
    
    if (matchupsError) {
      console.error('Matchups query error:', matchupsError)
      throw new Error(`Failed to fetch matchups: ${matchupsError.message}`)
    }
    
    // Get weekly scores
    const { data: weeklyScores, error: scoresError } = await supabase
      .from('weekly_scores')
      .select(`
        *,
        manager:managers!weekly_scores_manager_id_fkey(id, current_username, display_name),
        opponent:managers!weekly_scores_opponent_id_fkey(id, current_username, display_name)
      `)
      .eq('league_id', leagueId)
      .eq('season', seasonNum)
      .eq('week', weekNum)
    
    if (scoresError) {
      console.error('Scores query error:', scoresError)
      throw new Error(`Failed to fetch weekly scores: ${scoresError.message}`)
    }
    
    // Handle empty data
    if (!matchups || matchups.length === 0) {
      return NextResponse.json(
        { success: false, error: `No matchup data found for ${season} Week ${week}` },
        { status: 404 }
      )
    }
    
    if (!weeklyScores || weeklyScores.length === 0) {
      return NextResponse.json(
        { success: false, error: `No score data found for ${season} Week ${week}` },
        { status: 404 }
      )
    }
    
    // Get standings up to this week
    const { data: standingsData, error: standingsError } = await supabase
      .from('weekly_scores')
      .select(`
        manager_id,
        points_for,
        points_against,
        h2h_win,
        median_win,
        allplay_wins,
        allplay_losses,
        managers!weekly_scores_manager_id_fkey(id, current_username, display_name)
      `)
      .eq('league_id', leagueId)
      .eq('season', seasonNum)
      .lte('week', weekNum)
      .lt('week', playoffWeekStart)
    
    if (standingsError) {
      console.error('Standings query error:', standingsError)
      throw new Error(`Failed to fetch standings: ${standingsError.message}`)
    }
    
    // Aggregate standings
    const managerStats = new Map<string, {
      managerId: string
      displayName: string
      h2hWins: number
      h2hLosses: number
      medianWins: number
      medianLosses: number
      allPlayWins: number
      allPlayLosses: number
      pointsFor: number
      pointsAgainst: number
    }>()
    
    for (const row of (standingsData || [])) {
      const manager = row.managers as unknown as { id: string; current_username: string; display_name: string } | null
      if (!manager) continue
      
      const existing = managerStats.get(row.manager_id) || {
        managerId: row.manager_id,
        displayName: manager.display_name || manager.current_username,
        h2hWins: 0,
        h2hLosses: 0,
        medianWins: 0,
        medianLosses: 0,
        allPlayWins: 0,
        allPlayLosses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      }
      
      existing.h2hWins += row.h2h_win ? 1 : 0
      existing.h2hLosses += row.h2h_win ? 0 : 1
      existing.medianWins += row.median_win ? 1 : 0
      existing.medianLosses += row.median_win ? 0 : 1
      existing.allPlayWins += row.allplay_wins || 0
      existing.allPlayLosses += row.allplay_losses || 0
      existing.pointsFor += parseFloat(row.points_for) || 0
      existing.pointsAgainst += parseFloat(row.points_against) || 0
      
      managerStats.set(row.manager_id, existing)
    }
    
    // Sort standings by combined wins, then PF
    const standings = Array.from(managerStats.values())
      .sort((a, b) => {
        const aCombined = a.h2hWins + a.medianWins
        const bCombined = b.h2hWins + b.medianWins
        if (bCombined !== aCombined) return bCombined - aCombined
        return b.pointsFor - a.pointsFor
      })
      .map((s, i) => ({
        rank: i + 1,
        displayName: s.displayName,
        record: {
          h2h: { wins: s.h2hWins, losses: s.h2hLosses },
          median: { wins: s.medianWins, losses: s.medianLosses },
          combined: { wins: s.h2hWins + s.medianWins, losses: s.h2hLosses + s.medianLosses },
          allPlay: { wins: s.allPlayWins, losses: s.allPlayLosses },
        },
        points: { for: s.pointsFor, against: s.pointsAgainst },
      }))
    
    // Calculate week summary
    const weekScores = weeklyScores.map(s => parseFloat(s.points_for) || 0).sort((a, b) => b - a)
    const median = weekScores.length > 0 
      ? (weekScores[Math.floor(weekScores.length / 2) - 1] + weekScores[Math.floor(weekScores.length / 2)]) / 2
      : 0
    
    const topScorer = weeklyScores.reduce((max, s) => 
      (parseFloat(s.points_for) || 0) > (parseFloat(max.points_for) || 0) ? s : max
    , weeklyScores[0])
    
    const bottomScorer = weeklyScores.reduce((min, s) => 
      (parseFloat(s.points_for) || 0) < (parseFloat(min.points_for) || 0) ? s : min
    , weeklyScores[0])
    
    // Build report data with safe access
    const reportData: WeeklyReportData = {
      season: seasonNum,
      week: weekNum,
      playoffWeekStart,
      matchups: matchups.map(m => {
        // Safe access to nested objects
        const team1 = m.team1 as { display_name?: string; current_username?: string } | null
        const team2 = m.team2 as { display_name?: string; current_username?: string } | null
        const winner = m.winner as { display_name?: string; current_username?: string } | null
        
        return {
          week: m.week,
          team1: {
            name: team1?.display_name || team1?.current_username || 'Unknown',
            points: parseFloat(m.team1_points) || 0,
            managerId: m.team1_manager_id,
          },
          team2: {
            name: team2?.display_name || team2?.current_username || 'Unknown',
            points: parseFloat(m.team2_points) || 0,
            managerId: m.team2_manager_id,
          },
          winner: {
            name: winner?.display_name || winner?.current_username || 'TBD',
            managerId: m.winner_manager_id || '',
          },
          pointDifferential: parseFloat(m.point_differential) || 0,
          isPlayoff: m.is_playoff || false,
          matchupType: m.is_playoff ? (m.is_toilet_bowl ? 'Toilet Bowl' : 'Playoff') : undefined,
        }
      }),
      standings,
      weeklyScores: weeklyScores.map(s => {
        const manager = s.manager as { display_name?: string; current_username?: string } | null
        const opponent = s.opponent as { display_name?: string; current_username?: string } | null
        
        return {
          managerName: manager?.display_name || manager?.current_username || 'Unknown',
          points: {
            for: parseFloat(s.points_for) || 0,
            against: parseFloat(s.points_against) || 0,
          },
          results: {
            h2hWin: s.h2h_win || false,
            medianWin: s.median_win || false,
            weeklyRank: s.weekly_rank || 0,
            allPlayWins: s.allplay_wins || 0,
            allPlayLosses: s.allplay_losses || 0,
          },
          opponentName: opponent?.display_name || opponent?.current_username || '',
        }
      }),
      summary: {
        median,
        highest: weekScores[0] || 0,
        lowest: weekScores[weekScores.length - 1] || 0,
        topScorer: (topScorer?.manager as { display_name?: string; current_username?: string } | null)?.display_name 
          || (topScorer?.manager as { display_name?: string; current_username?: string } | null)?.current_username 
          || 'Unknown',
        bottomScorer: (bottomScorer?.manager as { display_name?: string; current_username?: string } | null)?.display_name 
          || (bottomScorer?.manager as { display_name?: string; current_username?: string } | null)?.current_username 
          || 'Unknown',
      },
    }
    
    // Return based on format
    if (format === 'json') {
      return NextResponse.json({ success: true, data: reportData })
    }
    
    // Generate HTML report
    const htmlReport = generateWeeklyReport(reportData)
    
    return new NextResponse(htmlReport, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
    
  } catch (error) {
    console.error('Weekly report generation failed:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
