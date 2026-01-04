import { NextRequest, NextResponse } from 'next/server'
import { ENDPOINTS } from '@/lib/sleeper/config'
import { fetchFromSleeper } from '@/lib/sleeper/fetch'

interface SleeperUser {
  user_id: string
  username: string
  display_name: string
  avatar: string | null
}

interface SleeperLeague {
  league_id: string
  name: string
  season: string
  status: string
  sport: string
  total_rosters: number
  roster_positions: string[]
  settings: {
    playoff_week_start: number
    playoff_teams: number
  }
  avatar: string | null
  previous_league_id: string | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')
  const season = searchParams.get('season') || '2024'

  if (!username) {
    return NextResponse.json(
      { success: false, error: 'Username is required' },
      { status: 400 }
    )
  }

  try {
    // 1. Fetch user info by username
    const user = await fetchFromSleeper<SleeperUser>(ENDPOINTS.user(username))
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // 2. Fetch user's NFL leagues for the given season
    const leagues = await fetchFromSleeper<SleeperLeague[]>(
      ENDPOINTS.userLeagues(user.user_id, season)
    )

    if (!leagues || leagues.length === 0) {
      return NextResponse.json({
        success: true,
        user: {
          user_id: user.user_id,
          username: user.username,
          display_name: user.display_name,
          avatar: user.avatar,
        },
        leagues: [],
        message: `No NFL leagues found for ${season} season`,
      })
    }

    // 3. Filter to only active/complete fantasy football leagues
    const footballLeagues = leagues
      .filter(league => league.sport === 'nfl')
      .map(league => ({
        league_id: league.league_id,
        name: league.name,
        season: league.season,
        status: league.status,
        total_rosters: league.total_rosters,
        avatar: league.avatar,
        playoff_week_start: league.settings?.playoff_week_start,
        previous_league_id: league.previous_league_id,
      }))

    return NextResponse.json({
      success: true,
      user: {
        user_id: user.user_id,
        username: user.username,
        display_name: user.display_name,
        avatar: user.avatar,
      },
      leagues: footballLeagues,
    })

  } catch (error) {
    console.error('Sleeper API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data from Sleeper' },
      { status: 500 }
    )
  }
}
