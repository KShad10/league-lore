import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateWeeklyReport, WeeklyReportData, ReportSections } from '@/lib/reports'
import { generateWeeklyCommentary, WeeklyCommentary, CommentaryConfig } from '@/lib/ai'
import { VoicePreset, ReportTemplate } from '@/lib/ai/prompts'

interface RouteParams {
  params: Promise<{ leagueId: string }>
}

// Default sections config
const DEFAULT_SECTIONS: ReportSections = {
  standings: { enabled: true },
  matchups: { enabled: true },
  awards: { enabled: true },
  powerRankings: { enabled: false },
  transactions: { enabled: false },
  injuries: { enabled: false },
  playoffPicture: { enabled: true }, // Auto-enabled based on week
}

// GET handler - backwards compatible, uses defaults
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params
  const { searchParams } = new URL(request.url)
  const season = searchParams.get('season')
  const week = searchParams.get('week')
  const format = searchParams.get('format') || 'html'
  
  return handleReportGeneration(leagueId, {
    season,
    week,
    format,
    sections: DEFAULT_SECTIONS,
    voice: 'supreme_leader',
    template: 'standard',
    useAiCommentary: false, // GET requests use static phrases for speed
  })
}

// POST handler - accepts full configuration
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'html'
  
  try {
    const body = await request.json()
    const {
      season,
      week,
      sections = DEFAULT_SECTIONS,
      voice = 'supreme_leader',
      template = 'standard',
      customVoice,
      useAiCommentary = true,
    } = body
    
    return handleReportGeneration(leagueId, {
      season: String(season),
      week: String(week),
      format,
      sections,
      voice,
      template,
      customVoice,
      useAiCommentary,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Invalid request body: ${error}` },
      { status: 400 }
    )
  }
}

interface GenerationOptions {
  season: string | null
  week: string | null
  format: string
  sections: ReportSections
  voice: VoicePreset
  template: ReportTemplate
  customVoice?: string
  useAiCommentary: boolean
}

async function handleReportGeneration(
  leagueId: string,
  options: GenerationOptions
): Promise<NextResponse> {
  const { season, week, format, sections, voice, template, customVoice, useAiCommentary } = options
  
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
        managerId: s.managerId,
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
    
    // Build matchup records map
    const recordsMap = new Map(
      standings.map(s => [s.managerId, `${s.record.combined.wins}-${s.record.combined.losses}`])
    )
    
    // Build report data with safe access
    const reportData: WeeklyReportData = {
      season: seasonNum,
      week: weekNum,
      playoffWeekStart,
      matchups: matchups.map(m => {
        // Safe access to nested objects
        const team1 = m.team1 as unknown as { id: string; display_name?: string; current_username?: string } | null
        const team2 = m.team2 as unknown as { id: string; display_name?: string; current_username?: string } | null
        const winner = m.winner as unknown as { display_name?: string; current_username?: string } | null
        
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
        const manager = s.manager as unknown as { id: string; display_name?: string; current_username?: string } | null
        const opponent = s.opponent as unknown as { display_name?: string; current_username?: string } | null
        
        return {
          managerId: manager?.id || '',
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
        topScorer: (topScorer?.manager as unknown as { display_name?: string; current_username?: string } | null)?.display_name 
          || (topScorer?.manager as unknown as { display_name?: string; current_username?: string } | null)?.current_username 
          || 'Unknown',
        bottomScorer: (bottomScorer?.manager as unknown as { display_name?: string; current_username?: string } | null)?.display_name 
          || (bottomScorer?.manager as unknown as { display_name?: string; current_username?: string } | null)?.current_username 
          || 'Unknown',
      },
    }
    
    // Generate AI commentary if requested
    let commentary: WeeklyCommentary | undefined
    if (useAiCommentary) {
      try {
        // Get league context for AI
        const { data: league } = await supabase
          .from('leagues')
          .select('name')
          .eq('id', leagueId)
          .single()
        
        const { data: managers } = await supabase
          .from('managers')
          .select('current_username, display_name, nickname, context_notes')
          .eq('league_id', leagueId)
          .eq('is_active', true)
        
        const commentaryConfig: CommentaryConfig = {
          voice,
          template,
          customVoice: voice === 'custom' ? customVoice : undefined,
          leagueContext: {
            leagueName: league?.name || 'Dynasty League',
            format: 'SuperFlex, 0.5 TE Premium',
            scoringType: 'H2H + Median (dual scoring)',
            playoffFormat: '6 teams qualify, seeds 1-2 get byes, weeks 15-17',
            managers: managers?.map(m => ({
              username: m.current_username,
              displayName: m.display_name || undefined,
              nickname: m.nickname || undefined,
              contextNotes: m.context_notes || undefined,
            })),
          },
        }
        
        // Transform data for commentary generator
        const commentaryData = {
          season: seasonNum,
          week: weekNum,
          playoffWeekStart,
          summary: reportData.summary,
          matchups: reportData.matchups.map(m => {
            const isTeam1Winner = m.winner.managerId === m.team1.managerId
            return {
              winner: isTeam1Winner ? m.team1.name : m.team2.name,
              winnerScore: isTeam1Winner ? m.team1.points : m.team2.points,
              loser: isTeam1Winner ? m.team2.name : m.team1.name,
              loserScore: isTeam1Winner ? m.team2.points : m.team1.points,
              margin: m.pointDifferential,
              winnerRecord: recordsMap.get(m.winner.managerId) || '0-0',
              loserRecord: recordsMap.get(isTeam1Winner ? m.team2.managerId : m.team1.managerId) || '0-0',
            }
          }),
          standings: standings.map(s => ({
            rank: s.rank,
            name: s.displayName,
            combinedWins: s.record.combined.wins,
            combinedLosses: s.record.combined.losses,
            pointsFor: s.points.for,
          })),
          weeklyScores: reportData.weeklyScores.map(s => ({
            name: s.managerName,
            score: s.points.for,
            rank: s.results.weeklyRank,
            allPlayWins: s.results.allPlayWins,
            allPlayLosses: s.results.allPlayLosses,
          })),
        }
        
        commentary = await generateWeeklyCommentary(commentaryData, commentaryConfig)
      } catch (aiError) {
        console.error('AI commentary generation failed, falling back to static:', aiError)
        // Continue without AI commentary - will use static phrases
      }
    }
    
    // Return based on format
    if (format === 'json') {
      return NextResponse.json({ 
        success: true, 
        data: reportData,
        commentary,
        sections,
      })
    }
    
    // Generate HTML report with sections config and commentary
    const htmlReport = generateWeeklyReport(reportData, { sections, commentary })
    
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
