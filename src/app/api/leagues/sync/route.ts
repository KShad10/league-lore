import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getLeagueHistory,
  getLeagueUsers,
  getLeagueRosters,
  getWeekMatchups,
  processWeekMatchups,
} from '@/lib/sleeper'

interface SyncRequest {
  sleeper_league_id: string
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: SyncRequest = await request.json()
    const { sleeper_league_id } = body
    
    if (!sleeper_league_id) {
      return NextResponse.json(
        { success: false, error: 'sleeper_league_id is required' },
        { status: 400 }
      )
    }
    
    console.log(`Starting sync for league: ${sleeper_league_id}, user: ${user.id}`)
    
    // 1. Fetch league history from Sleeper
    const leagueHistory = await getLeagueHistory(sleeper_league_id)
    console.log(`Found ${leagueHistory.length} seasons`)
    
    if (leagueHistory.length === 0) {
      return NextResponse.json(
        { success: false, error: 'League not found' },
        { status: 404 }
      )
    }
    
    const currentLeague = leagueHistory[leagueHistory.length - 1]
    const firstLeague = leagueHistory[0]
    
    // 2. Ensure user exists in our users table
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()
    
    if (!existingUser) {
      // Create user record linked to auth user
      const { error: userError } = await supabase
        .from('users')
        .insert({ 
          id: user.id,
          email: user.email 
        })
      
      if (userError && !userError.message.includes('duplicate')) {
        console.error('User creation error:', userError)
        return NextResponse.json(
          { success: false, error: `Failed to create user: ${userError.message}` },
          { status: 500 }
        )
      }
    }
    
    const userId = user.id
    console.log(`Using user ID: ${userId}`)
    
    // 3. Create or update league record
    const { data: leagueData, error: leagueError } = await supabase
      .from('leagues')
      .upsert({
        user_id: userId,
        sleeper_league_id: sleeper_league_id,
        name: currentLeague.name,
        team_count: currentLeague.totalRosters,
        roster_positions: currentLeague.rosterPositions,
        scoring_settings: currentLeague.scoringSettings,
        first_season: parseInt(firstLeague.season),
        current_season: parseInt(currentLeague.season),
        last_sync_at: new Date().toISOString(),
      }, { 
        onConflict: 'user_id,sleeper_league_id',
      })
      .select()
      .single()
    
    if (leagueError) {
      console.error('League upsert error:', leagueError)
      return NextResponse.json(
        { success: false, error: `Failed to save league: ${leagueError.message}` },
        { status: 500 }
      )
    }
    
    const leagueId = leagueData.id
    console.log(`League saved with ID: ${leagueId}`)
    
    // 4. Process each season
    const stats = {
      seasons: 0,
      managersProcessed: 0,
      weeklyScores: 0,
      matchups: 0,
    }
    
    const managerMap = new Map<string, string>()
    
    for (const seasonLeague of leagueHistory) {
      const season = parseInt(seasonLeague.season)
      console.log(`Processing season ${season}...`)
      
      // Save league settings history
      await supabase
        .from('league_settings_history')
        .upsert({
          league_id: leagueId,
          season,
          roster_positions: seasonLeague.rosterPositions,
          scoring_settings: seasonLeague.scoringSettings,
        }, { onConflict: 'league_id,season' })
      
      // Fetch users and rosters for this season
      const [users, rosters] = await Promise.all([
        getLeagueUsers(seasonLeague.leagueId),
        getLeagueRosters(seasonLeague.leagueId),
      ])
      
      const userMap = new Map(users.map(u => [u.userId, u]))
      
      // Upsert managers
      for (const roster of rosters) {
        const sleeperUser = userMap.get(roster.ownerId)
        if (!sleeperUser) {
          console.warn(`No user found for roster ${roster.rosterId}`)
          continue
        }
        
        const { data: managerData, error: managerError } = await supabase
          .from('managers')
          .upsert({
            league_id: leagueId,
            sleeper_user_id: sleeperUser.userId,
            sleeper_roster_id: roster.rosterId,
            current_username: sleeperUser.displayName,
            avatar_url: sleeperUser.avatar,
            is_active: true,
          }, { 
            onConflict: 'league_id,sleeper_user_id',
          })
          .select()
          .single()
        
        if (managerError) {
          console.error('Manager upsert error:', managerError)
          continue
        }
        
        managerMap.set(sleeperUser.userId, managerData.id)
        stats.managersProcessed++
      }
      
      // Create roster_id -> manager_id lookup for this season
      const rosterToManager = new Map<number, string>()
      for (const roster of rosters) {
        const sleeperUser = userMap.get(roster.ownerId)
        if (sleeperUser && managerMap.has(sleeperUser.userId)) {
          rosterToManager.set(roster.rosterId, managerMap.get(sleeperUser.userId)!)
        }
      }
      
      // Determine weeks to process
      const playoffWeekStart = seasonLeague.settings.playoffWeekStart || 15
      const totalWeeks = 17
      
      for (let week = 1; week <= totalWeeks; week++) {
        const matchups = await getWeekMatchups(seasonLeague.leagueId, week)
        
        if (matchups.length === 0) {
          continue
        }
        
        const weekResults = processWeekMatchups(matchups)
        
        // Upsert weekly_scores
        for (const result of weekResults) {
          const managerId = rosterToManager.get(result.rosterId)
          const opponentManagerId = rosterToManager.get(result.opponentRosterId)
          
          if (!managerId) {
            console.warn(`No manager found for roster ${result.rosterId}`)
            continue
          }
          
          const { error: scoreError } = await supabase
            .from('weekly_scores')
            .upsert({
              league_id: leagueId,
              manager_id: managerId,
              season,
              week,
              points_for: result.pointsFor,
              points_against: result.pointsAgainst,
              opponent_id: opponentManagerId || null,
              matchup_id: result.matchupId,
              h2h_win: result.h2hWin,
              median_win: result.medianWin,
              weekly_rank: result.weeklyRank,
              allplay_wins: result.allplayWins,
              allplay_losses: result.allplayLosses,
            }, { onConflict: 'league_id,manager_id,season,week' })
          
          if (scoreError) {
            console.error('Weekly score upsert error:', scoreError)
          } else {
            stats.weeklyScores++
          }
        }
        
        // Upsert matchups
        const processedMatchups = new Set<number>()
        for (const result of weekResults) {
          if (processedMatchups.has(result.matchupId)) continue
          processedMatchups.add(result.matchupId)
          
          const matchupTeams = weekResults.filter(r => r.matchupId === result.matchupId)
          if (matchupTeams.length !== 2) continue
          
          const [team1, team2] = matchupTeams
          const team1ManagerId = rosterToManager.get(team1.rosterId)
          const team2ManagerId = rosterToManager.get(team2.rosterId)
          
          if (!team1ManagerId || !team2ManagerId) continue
          
          const winnerId = team1.pointsFor > team2.pointsFor ? team1ManagerId : team2ManagerId
          const isPlayoff = week >= playoffWeekStart
          
          const { error: matchupError } = await supabase
            .from('matchups')
            .upsert({
              league_id: leagueId,
              season,
              week,
              matchup_id: result.matchupId,
              team1_manager_id: team1ManagerId,
              team1_points: team1.pointsFor,
              team2_manager_id: team2ManagerId,
              team2_points: team2.pointsFor,
              winner_manager_id: winnerId,
              point_differential: Math.abs(team1.pointsFor - team2.pointsFor),
              is_playoff: isPlayoff,
              is_toilet_bowl: false,
              playoff_round: isPlayoff ? week - playoffWeekStart + 1 : null,
            }, { onConflict: 'league_id,season,week,matchup_id' })
          
          if (matchupError) {
            console.error('Matchup upsert error:', matchupError)
          } else {
            stats.matchups++
          }
        }
      }
      
      stats.seasons++
    }
    
    return NextResponse.json({
      success: true,
      leagueId,
      userId,
      league: {
        name: currentLeague.name,
        seasons: stats.seasons,
      },
      stats: {
        ...stats,
        uniqueManagers: managerMap.size,
      },
      message: `Synced ${stats.seasons} seasons, ${managerMap.size} unique managers, ${stats.weeklyScores} weekly scores, ${stats.matchups} matchups`,
    })
    
  } catch (error) {
    console.error('Sync failed:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
