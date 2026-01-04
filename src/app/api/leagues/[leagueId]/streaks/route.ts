import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ leagueId: string }>
}

interface WeeklyResult {
  season: number
  week: number
  h2h_win: boolean | null
  median_win: boolean | null
}

interface StreakInfo {
  length: number
  manager?: string
  managerId?: string
  season?: number
  startWeek?: number
  endWeek?: number
}

function calculateSingleTypeStreak(
  results: WeeklyResult[],
  type: 'h2h' | 'median'
): { type: 'W' | 'L' | null; length: number } {
  if (results.length === 0) return { type: null, length: 0 }
  
  const sorted = [...results].sort((a, b) => {
    if (a.season !== b.season) return b.season - a.season
    return b.week - a.week
  })
  
  const values = sorted.map(r => type === 'h2h' ? r.h2h_win : r.median_win)
  const validValues = values.filter(v => v !== null) as boolean[]
  
  if (validValues.length === 0) return { type: null, length: 0 }
  
  const firstResult = validValues[0]
  let count = 0
  
  for (const val of validValues) {
    if (val === firstResult) {
      count++
    } else {
      break
    }
  }
  
  return {
    type: firstResult ? 'W' : 'L',
    length: count,
  }
}

function calculateCombinedStreak(
  results: WeeklyResult[]
): { type: 'W' | 'L' | null; length: number } {
  if (results.length === 0) return { type: null, length: 0 }
  
  const sorted = [...results].sort((a, b) => {
    if (a.season !== b.season) return b.season - a.season
    return b.week - a.week
  })
  
  const flatResults: ('W' | 'L')[] = []
  for (const week of sorted) {
    if (week.median_win === null && week.h2h_win === null) continue
    if (week.median_win !== null) {
      flatResults.push(week.median_win ? 'W' : 'L')
    }
    if (week.h2h_win !== null) {
      flatResults.push(week.h2h_win ? 'W' : 'L')
    }
  }
  
  if (flatResults.length === 0) return { type: null, length: 0 }
  
  const streakType = flatResults[0]
  let streakLength = 0
  
  for (const result of flatResults) {
    if (result === streakType) {
      streakLength++
    } else {
      break
    }
  }
  
  return { type: streakType, length: streakLength }
}

function findLongestStreakWithDetails(
  results: WeeklyResult[],
  resultType: 'h2h' | 'median' | 'combined',
  winOrLoss: 'W' | 'L'
): { length: number; season: number; startWeek: number; endWeek: number } {
  const sorted = [...results].sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season
    return a.week - b.week
  })
  
  interface GameResult {
    season: number
    week: number
    result: boolean
  }
  
  const flatResults: GameResult[] = []
  
  if (resultType === 'combined') {
    for (const week of sorted) {
      if (week.h2h_win !== null) {
        flatResults.push({ season: week.season, week: week.week, result: week.h2h_win })
      }
      if (week.median_win !== null) {
        flatResults.push({ season: week.season, week: week.week, result: week.median_win })
      }
    }
  } else {
    for (const week of sorted) {
      const val = resultType === 'h2h' ? week.h2h_win : week.median_win
      if (val !== null) {
        flatResults.push({ season: week.season, week: week.week, result: val })
      }
    }
  }
  
  const targetValue = winOrLoss === 'W'
  let maxStreak = 0
  let currentStreak = 0
  let maxStreakStart = 0
  let maxStreakEnd = 0
  let currentStreakStart = 0
  
  for (let i = 0; i < flatResults.length; i++) {
    if (flatResults[i].result === targetValue) {
      if (currentStreak === 0) currentStreakStart = i
      currentStreak++
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak
        maxStreakStart = currentStreakStart
        maxStreakEnd = i
      }
    } else {
      currentStreak = 0
    }
  }
  
  if (maxStreak === 0 || flatResults.length === 0) {
    return { length: 0, season: 0, startWeek: 0, endWeek: 0 }
  }
  
  return {
    length: maxStreak,
    season: flatResults[maxStreakStart].season,
    startWeek: flatResults[maxStreakStart].week,
    endWeek: flatResults[maxStreakEnd].week,
  }
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
    
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('current_season')
      .eq('id', leagueId)
      .single()
    
    if (leagueError) {
      return NextResponse.json(
        { success: false, error: `League not found: ${leagueError.message}` },
        { status: 404 }
      )
    }
    
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
    
    const { data: managers, error: managersError } = await supabase
      .from('managers')
      .select('id, current_username, display_name')
      .eq('league_id', leagueId)
    
    if (managersError) {
      return NextResponse.json(
        { success: false, error: managersError.message },
        { status: 500 }
      )
    }
    
    if (!managers || managers.length === 0) {
      return NextResponse.json({
        success: true,
        leagueId,
        streaks: []
      })
    }
    
    let query = supabase
      .from('weekly_scores')
      .select('manager_id, season, week, h2h_win, median_win')
      .eq('league_id', leagueId)
      .order('season', { ascending: true })
      .order('week', { ascending: true })
    
    if (seasonParam) {
      query = query.eq('season', parseInt(seasonParam))
    }
    
    const { data: allScores, error: scoresError } = await query
    
    if (scoresError) {
      return NextResponse.json(
        { success: false, error: scoresError.message },
        { status: 500 }
      )
    }
    
    const filteredScores = includePlayoffs
      ? (allScores || [])
      : (allScores || []).filter(row => {
          const playoffStart = playoffStartMap.get(row.season) || 15
          return row.week < playoffStart
        })
    
    const isAllSeasons = !seasonParam
    
    // Calculate streaks for each manager
    const streaks = managers.map(manager => {
      const managerResults: WeeklyResult[] = filteredScores
        .filter(s => s.manager_id === manager.id)
        .map(s => ({
          season: s.season,
          week: s.week,
          h2h_win: s.h2h_win,
          median_win: s.median_win,
        }))
      
      const h2hStreak = calculateSingleTypeStreak(managerResults, 'h2h')
      const medianStreak = calculateSingleTypeStreak(managerResults, 'median')
      const combinedStreak = calculateCombinedStreak(managerResults)
      
      const longestH2hWin = findLongestStreakWithDetails(managerResults, 'h2h', 'W')
      const longestH2hLoss = findLongestStreakWithDetails(managerResults, 'h2h', 'L')
      const longestMedianWin = findLongestStreakWithDetails(managerResults, 'median', 'W')
      const longestMedianLoss = findLongestStreakWithDetails(managerResults, 'median', 'L')
      const longestCombinedWin = findLongestStreakWithDetails(managerResults, 'combined', 'W')
      const longestCombinedLoss = findLongestStreakWithDetails(managerResults, 'combined', 'L')
      
      return {
        managerId: manager.id,
        name: manager.display_name || manager.current_username,
        currentStreaks: {
          h2h: {
            type: h2hStreak.type,
            length: h2hStreak.length,
            display: h2hStreak.type ? `${h2hStreak.length}${h2hStreak.type}` : '-',
          },
          median: {
            type: medianStreak.type,
            length: medianStreak.length,
            display: medianStreak.type ? `${medianStreak.length}${medianStreak.type}` : '-',
          },
          combined: {
            type: combinedStreak.type,
            length: combinedStreak.length,
            display: combinedStreak.type ? `${combinedStreak.length}${combinedStreak.type}` : '-',
          },
        },
        longestStreaks: {
          h2h: { 
            win: longestH2hWin,
            loss: longestH2hLoss,
          },
          median: { 
            win: longestMedianWin,
            loss: longestMedianLoss,
          },
          combined: { 
            win: longestCombinedWin,
            loss: longestCombinedLoss,
          },
        },
        weeksPlayed: managerResults.length,
      }
    })
    
    // Sort
    if (isAllSeasons) {
      streaks.sort((a, b) => b.longestStreaks.combined.win.length - a.longestStreaks.combined.win.length)
    } else {
      streaks.sort((a, b) => {
        const aValue = a.currentStreaks.combined.type === 'W' 
          ? a.currentStreaks.combined.length 
          : a.currentStreaks.combined.type === 'L'
          ? -a.currentStreaks.combined.length
          : 0
        const bValue = b.currentStreaks.combined.type === 'W' 
          ? b.currentStreaks.combined.length 
          : b.currentStreaks.combined.type === 'L'
          ? -b.currentStreaks.combined.length
          : 0
        return bValue - aValue
      })
    }
    
    // Find league records
    const findRecordHolder = (
      type: 'h2h' | 'median' | 'combined',
      winOrLoss: 'win' | 'loss'
    ): StreakInfo => {
      let best: StreakInfo = { length: 0 }
      for (const streak of streaks) {
        const streakData = streak.longestStreaks[type][winOrLoss]
        if (streakData.length > best.length) {
          best = {
            length: streakData.length,
            manager: streak.name,
            managerId: streak.managerId,
            season: streakData.season,
            startWeek: streakData.startWeek,
            endWeek: streakData.endWeek,
          }
        }
      }
      return best
    }
    
    const season = seasonParam ? parseInt(seasonParam) : league.current_season
    const playoffWeekStart = playoffStartMap.get(season) || 15
    
    return NextResponse.json({
      success: true,
      leagueId,
      season: seasonParam ? parseInt(seasonParam) : 'all',
      isAllSeasons,
      includePlayoffs,
      regularSeasonWeeks: playoffWeekStart - 1,
      playoffWeekStart,
      streaks,
      leagueRecords: {
        h2hWin: findRecordHolder('h2h', 'win'),
        h2hLoss: findRecordHolder('h2h', 'loss'),
        medianWin: findRecordHolder('median', 'win'),
        medianLoss: findRecordHolder('median', 'loss'),
        combinedWin: findRecordHolder('combined', 'win'),
        combinedLoss: findRecordHolder('combined', 'loss'),
      },
    })
    
  } catch (error) {
    console.error('Streaks query failed:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
