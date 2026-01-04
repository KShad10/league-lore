import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ leagueId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params
  const { searchParams } = new URL(request.url)
  const managerId = searchParams.get('managerId')
  const matchupType = searchParams.get('type') || 'all'
  
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
    
    // Get all managers for name lookup
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
        managers: [],
        records: []
      })
    }
    
    const managerMap = new Map(managers.map(m => [m.id, m.display_name || m.current_username]))
    
    // Get all matchups for this league
    let query = supabase
      .from('matchups')
      .select('*')
      .eq('league_id', leagueId)
    
    if (matchupType === 'regular') {
      query = query.eq('is_playoff', false)
    } else if (matchupType === 'playoff') {
      query = query.eq('is_playoff', true)
    }
    
    const { data: matchups, error: matchupsError } = await query
    
    if (matchupsError) {
      return NextResponse.json(
        { success: false, error: matchupsError.message },
        { status: 500 }
      )
    }
    
    if (!matchups || matchups.length === 0) {
      return NextResponse.json({
        success: true,
        leagueId,
        managers: managers.map(m => ({ id: m.id, name: m.display_name || m.current_username })),
        records: []
      })
    }
    
    // Calculate H2H records between all manager pairs
    const h2hMap = new Map<string, {
      manager1Id: string
      manager2Id: string
      wins: number
      losses: number
      totalPF: number
      totalPA: number
      matchupCount: number
    }>()
    
    for (const matchup of matchups) {
      const key1 = `${matchup.team1_manager_id}-${matchup.team2_manager_id}`
      const existing1 = h2hMap.get(key1) || {
        manager1Id: matchup.team1_manager_id,
        manager2Id: matchup.team2_manager_id,
        wins: 0,
        losses: 0,
        totalPF: 0,
        totalPA: 0,
        matchupCount: 0,
      }
      
      existing1.totalPF += parseFloat(String(matchup.team1_points)) || 0
      existing1.totalPA += parseFloat(String(matchup.team2_points)) || 0
      existing1.matchupCount++
      
      if (matchup.winner_manager_id === matchup.team1_manager_id) {
        existing1.wins++
      } else {
        existing1.losses++
      }
      
      h2hMap.set(key1, existing1)
    }
    
    // Convert to array
    let records = Array.from(h2hMap.values()).map(record => ({
      manager1: {
        id: record.manager1Id,
        name: managerMap.get(record.manager1Id) || 'Unknown',
      },
      manager2: {
        id: record.manager2Id,
        name: managerMap.get(record.manager2Id) || 'Unknown',
      },
      matchups: record.matchupCount,
      wins: record.wins,
      losses: record.losses,
      winPct: record.wins + record.losses > 0
        ? Math.round((record.wins / (record.wins + record.losses)) * 1000) / 10
        : 0,
      pointsFor: Math.round(record.totalPF * 100) / 100,
      pointsAgainst: Math.round(record.totalPA * 100) / 100,
      avgMargin: record.matchupCount > 0
        ? Math.round(((record.totalPF - record.totalPA) / record.matchupCount) * 100) / 100
        : 0,
    }))
    
    // Filter by managerId if specified
    if (managerId) {
      records = records.filter(r => r.manager1.id === managerId)
    }
    
    // Sort by win percentage descending
    records.sort((a, b) => {
      if (b.winPct !== a.winPct) return b.winPct - a.winPct
      return b.wins - a.wins
    })
    
    return NextResponse.json({
      success: true,
      leagueId,
      filters: {
        managerId: managerId || 'all',
        matchupType,
      },
      managers: managers.map(m => ({ id: m.id, name: m.display_name || m.current_username })),
      count: records.length,
      records,
    })
    
  } catch (error) {
    console.error('H2H query failed:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
