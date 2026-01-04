import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has any leagues
    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('id, name, sleeper_league_id, team_count, first_season, current_season, last_sync_at')
      .eq('user_id', user.id)
      .order('last_sync_at', { ascending: false })

    if (leaguesError) {
      console.error('Error fetching leagues:', leaguesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch leagues' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      hasLeagues: leagues && leagues.length > 0,
      leagues: leagues || [],
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
