import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getLeagueHistory,
  getLeagueUsers,
  getLeagueRosters,
  getWeekMatchups,
  processWeekMatchups,
} from '@/lib/sleeper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SyncRequest {
  sleeper_league_id: string;
  user_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SyncRequest = await request.json();
    const { sleeper_league_id } = body;
    
    if (!sleeper_league_id) {
      return NextResponse.json(
        { success: false, error: 'sleeper_league_id is required' },
        { status: 400 }
      );
    }
    
    console.log(`Starting sync for league: ${sleeper_league_id}`);
    
    // 1. Fetch league history from Sleeper
    const leagueHistory = await getLeagueHistory(sleeper_league_id);
    console.log(`Found ${leagueHistory.length} seasons`);
    
    if (leagueHistory.length === 0) {
      return NextResponse.json(
        { success: false, error: 'League not found' },
        { status: 404 }
      );
    }
    
    const currentLeague = leagueHistory[leagueHistory.length - 1];
    const firstLeague = leagueHistory[0];
    
    // 2. Get or create test user
    let userId = body.user_id;
    
    if (!userId) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', 'test@leaguelore.app')
        .single();
      
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({ email: 'test@leaguelore.app' })
          .select('id')
          .single();
        
        if (userError) {
          console.error('User creation error:', userError);
          return NextResponse.json(
            { success: false, error: `Failed to create user: ${userError.message}` },
            { status: 500 }
          );
        }
        userId = newUser.id;
      }
    }
    
    console.log(`Using user ID: ${userId}`);
    
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
      .single();
    
    if (leagueError) {
      console.error('League upsert error:', leagueError);
      return NextResponse.json(
        { success: false, error: `Failed to save league: ${leagueError.message}` },
        { status: 500 }
      );
    }
    
    const leagueId = leagueData.id;
    console.log(`League saved with ID: ${leagueId}`);
    
    // 4. Process each season
    const stats = {
      seasons: 0,
      managersProcessed: 0,
      weeklyScores: 0,
      matchups: 0,
    };
    
    const managerMap = new Map<string, string>();
    
    for (const seasonLeague of leagueHistory) {
      const season = parseInt(seasonLeague.season);
      console.log(`Processing season ${season}...`);
      
      // Save league settings history - include all playoff and scoring settings
      await supabase
        .from('league_settings_history')
        .upsert({
          league_id: leagueId,
          season,
          roster_positions: seasonLeague.rosterPositions,
          scoring_settings: seasonLeague.scoringSettings,
          // Store all league settings including playoff format configuration
          league_settings: {
            // Basic settings
            playoff_week_start: seasonLeague.settings.playoffWeekStart,
            playoff_teams: seasonLeague.settings.playoffTeams,
            trade_deadline: seasonLeague.settings.tradeDeadline,
            total_rosters: seasonLeague.totalRosters,
            // Playoff format settings
            playoff_round_type: seasonLeague.settings.playoffRoundType,    // 0=one week, 1=two week champ, 2=two weeks all
            playoff_seed_type: seasonLeague.settings.playoffSeedType,      // 0=default, 1=re-seed
            playoff_type: seasonLeague.settings.playoffType,               // 0=standard, 1=two weeks per matchup
            // Lower bracket settings  
            loser_bracket_type: seasonLeague.settings.loserBracketType,    // 0=toilet bowl, 1=consolation
          },
        }, { onConflict: 'league_id,season' });
      
      // Fetch users and rosters for this season
      const [users, rosters] = await Promise.all([
        getLeagueUsers(seasonLeague.leagueId),
        getLeagueRosters(seasonLeague.leagueId),
      ]);
      
      const userMap = new Map(users.map(u => [u.userId, u]));
      
      // Upsert managers
      for (const roster of rosters) {
        const user = userMap.get(roster.ownerId);
        if (!user) {
          console.warn(`No user found for roster ${roster.rosterId}`);
          continue;
        }
        
        const { data: managerData, error: managerError } = await supabase
          .from('managers')
          .upsert({
            league_id: leagueId,
            sleeper_user_id: user.userId,
            sleeper_roster_id: roster.rosterId,
            current_username: user.displayName,
            avatar_url: user.avatar,
            is_active: true,
          }, { 
            onConflict: 'league_id,sleeper_user_id',
          })
          .select()
          .single();
        
        if (managerError) {
          console.error('Manager upsert error:', managerError);
          continue;
        }
        
        managerMap.set(user.userId, managerData.id);
        stats.managersProcessed++;
      }
      
      // Create roster_id -> manager_id lookup for this season
      const rosterToManager = new Map<number, string>();
      for (const roster of rosters) {
        const user = userMap.get(roster.ownerId);
        if (user && managerMap.has(user.userId)) {
          rosterToManager.set(roster.rosterId, managerMap.get(user.userId)!);
        }
      }
      
      // Determine weeks to process - use league's playoff setting
      const playoffWeekStart = seasonLeague.settings.playoffWeekStart || 15;
      const totalWeeks = 17; // NFL season max
      
      for (let week = 1; week <= totalWeeks; week++) {
        const matchups = await getWeekMatchups(seasonLeague.leagueId, week);
        
        if (matchups.length === 0) {
          continue;
        }
        
        const weekResults = processWeekMatchups(matchups);
        
        // Upsert weekly_scores
        for (const result of weekResults) {
          const managerId = rosterToManager.get(result.rosterId);
          const opponentManagerId = rosterToManager.get(result.opponentRosterId);
          
          if (!managerId) {
            console.warn(`No manager found for roster ${result.rosterId}`);
            continue;
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
            }, { onConflict: 'league_id,manager_id,season,week' });
          
          if (scoreError) {
            console.error('Weekly score upsert error:', scoreError);
          } else {
            stats.weeklyScores++;
          }
        }
        
        // Upsert matchups
        const processedMatchups = new Set<number>();
        for (const result of weekResults) {
          if (processedMatchups.has(result.matchupId)) continue;
          processedMatchups.add(result.matchupId);
          
          const matchupTeams = weekResults.filter(r => r.matchupId === result.matchupId);
          if (matchupTeams.length !== 2) continue;
          
          const [team1, team2] = matchupTeams;
          const team1ManagerId = rosterToManager.get(team1.rosterId);
          const team2ManagerId = rosterToManager.get(team2.rosterId);
          
          if (!team1ManagerId || !team2ManagerId) continue;
          
          const winnerId = team1.pointsFor > team2.pointsFor ? team1ManagerId : team2ManagerId;
          const isPlayoff = week >= playoffWeekStart;
          
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
            }, { onConflict: 'league_id,season,week,matchup_id' });
          
          if (matchupError) {
            console.error('Matchup upsert error:', matchupError);
          } else {
            stats.matchups++;
          }
        }
      }
      
      stats.seasons++;
    }
    
    return NextResponse.json({
      success: true,
      leagueId,
      userId,
      stats: {
        ...stats,
        uniqueManagers: managerMap.size,
      },
      message: `Synced ${stats.seasons} seasons, ${managerMap.size} unique managers, ${stats.weeklyScores} weekly scores, ${stats.matchups} matchups`,
    });
    
  } catch (error) {
    console.error('Sync failed:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
