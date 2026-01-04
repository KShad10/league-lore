import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ leagueId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params
  
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
    
    // Get manager details
    const { data: managerData, error: managerError } = await supabase
      .from('managers')
      .select('*')
      .eq('league_id', leagueId)
    
    if (managerError) {
      return NextResponse.json(
        { success: false, error: managerError.message },
        { status: 500 }
      )
    }
    
    if (!managerData || managerData.length === 0) {
      return NextResponse.json({
        success: true,
        leagueId,
        count: 0,
        managers: []
      })
    }
    
    // Get league settings to filter to regular season
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
    
    // Get all weekly scores for this league
    const { data: scores, error: scoresError } = await supabase
      .from('weekly_scores')
      .select('manager_id, season, week, h2h_win, median_win, allplay_wins, allplay_losses, points_for, points_against')
      .eq('league_id', leagueId)
    
    if (scoresError) {
      return NextResponse.json(
        { success: false, error: scoresError.message },
        { status: 500 }
      )
    }
    
    // Filter to regular season
    const regularSeasonScores = (scores || []).filter(s => {
      const playoffStart = playoffStartMap.get(s.season) || 15
      return s.week < playoffStart
    })
    
    // Calculate career stats for each manager
    const managers = managerData.map(manager => {
      const managerScores = regularSeasonScores.filter(s => s.manager_id === manager.id)
      
      const h2hWins = managerScores.filter(s => s.h2h_win === true).length
      const h2hLosses = managerScores.filter(s => s.h2h_win === false).length
      const medianWins = managerScores.filter(s => s.median_win === true).length
      const medianLosses = managerScores.filter(s => s.median_win === false).length
      const allplayWins = managerScores.reduce((sum, s) => sum + (s.allplay_wins || 0), 0)
      const allplayLosses = managerScores.reduce((sum, s) => sum + (s.allplay_losses || 0), 0)
      const totalPF = managerScores.reduce((sum, s) => sum + (parseFloat(String(s.points_for)) || 0), 0)
      const totalPA = managerScores.reduce((sum, s) => sum + (parseFloat(String(s.points_against)) || 0), 0)
      
      const totalWeeks = managerScores.length
      const combinedWins = h2hWins + medianWins
      const combinedLosses = h2hLosses + medianLosses
      
      const h2hWinPct = h2hWins + h2hLosses > 0 ? h2hWins / (h2hWins + h2hLosses) : 0
      const medianWinPct = medianWins + medianLosses > 0 ? medianWins / (medianWins + medianLosses) : 0
      const combinedWinPct = combinedWins + combinedLosses > 0 ? combinedWins / (combinedWins + combinedLosses) : 0
      const allplayWinPct = allplayWins + allplayLosses > 0 ? allplayWins / (allplayWins + allplayLosses) : 0
      
      return {
        id: manager.id,
        sleeperUserId: manager.sleeper_user_id,
        username: manager.current_username,
        displayName: manager.display_name || manager.current_username,
        nickname: manager.nickname,
        avatarUrl: manager.avatar_url,
        contextNotes: manager.context_notes,
        rivalryNotes: manager.rivalry_notes,
        isActive: manager.is_active,
        career: {
          totalWeeks,
          combined: {
            wins: combinedWins,
            losses: combinedLosses,
            winPct: Math.round(combinedWinPct * 10000) / 100,
          },
          h2h: {
            wins: h2hWins,
            losses: h2hLosses,
            winPct: Math.round(h2hWinPct * 10000) / 100,
          },
          median: {
            wins: medianWins,
            losses: medianLosses,
            winPct: Math.round(medianWinPct * 10000) / 100,
          },
          allPlay: {
            wins: allplayWins,
            losses: allplayLosses,
            winPct: Math.round(allplayWinPct * 10000) / 100,
          },
          points: {
            totalPF: Math.round(totalPF * 100) / 100,
            totalPA: Math.round(totalPA * 100) / 100,
            avgPerWeek: totalWeeks > 0 ? Math.round((totalPF / totalWeeks) * 100) / 100 : 0,
          },
        },
      }
    })
    
    // Calculate ranks
    const sortedByCombined = [...managers].sort((a, b) => b.career.combined.winPct - a.career.combined.winPct)
    const sortedByPF = [...managers].sort((a, b) => b.career.points.totalPF - a.career.points.totalPF)
    const sortedByPA = [...managers].sort((a, b) => b.career.points.totalPA - a.career.points.totalPA)
    
    const combinedRankMap = new Map(sortedByCombined.map((m, i) => [m.id, i + 1]))
    const pfRankMap = new Map(sortedByPF.map((m, i) => [m.id, i + 1]))
    const paRankMap = new Map(sortedByPA.map((m, i) => [m.id, i + 1]))
    
    // Add ranks
    const managersWithRanks = managers.map(m => ({
      ...m,
      career: {
        ...m.career,
        combined: { ...m.career.combined, rank: combinedRankMap.get(m.id) || 0 },
        points: { 
          ...m.career.points, 
          pfRank: pfRankMap.get(m.id) || 0,
          paRank: paRankMap.get(m.id) || 0,
        },
      },
    }))
    
    // Sort by career combined win percentage
    managersWithRanks.sort((a, b) => {
      if (b.career.combined.winPct !== a.career.combined.winPct) {
        return b.career.combined.winPct - a.career.combined.winPct
      }
      return b.career.points.totalPF - a.career.points.totalPF
    })
    
    // Add overall rank
    const rankedManagers = managersWithRanks.map((m, i) => ({ ...m, rank: i + 1 }))
    
    return NextResponse.json({
      success: true,
      leagueId,
      count: rankedManagers.length,
      managers: rankedManagers,
    })
    
  } catch (error) {
    console.error('Managers query failed:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
