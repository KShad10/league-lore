import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  generateWeeklyCommentary,
  generatePostseasonCommentary,
  generateRaw,
  WeeklyCommentaryData,
  PostseasonCommentaryData,
  CommentaryConfig,
} from '@/lib/ai';
import { VoicePreset, ReportTemplate } from '@/lib/ai/prompts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params;

  try {
    const body = await request.json();
    const {
      type,
      season,
      week,
      customPrompt,
      voice = 'supreme_leader',
      template = 'standard',
      customVoice,
    } = body;

    // Build config
    const config: CommentaryConfig = {
      voice: voice as VoicePreset,
      template: template as ReportTemplate,
      customVoice: voice === 'custom' ? customVoice : undefined,
    };

    // Fetch league context for managers
    const leagueContext = await fetchLeagueContext(leagueId);
    if (leagueContext) {
      config.leagueContext = leagueContext;
    }

    // Custom prompt mode - just pass through to Claude
    if (type === 'custom' && customPrompt) {
      const result = await generateRaw(customPrompt, config);
      return NextResponse.json({ success: true, commentary: result });
    }

    // Weekly commentary
    if (type === 'weekly') {
      if (!season || !week) {
        return NextResponse.json(
          { success: false, error: 'Season and week required for weekly commentary' },
          { status: 400 }
        );
      }

      const data = await fetchWeeklyData(leagueId, parseInt(season), parseInt(week));
      const commentary = await generateWeeklyCommentary(data, config);

      return NextResponse.json({ success: true, commentary });
    }

    // Postseason commentary
    if (type === 'postseason') {
      if (!season) {
        return NextResponse.json(
          { success: false, error: 'Season required for postseason commentary' },
          { status: 400 }
        );
      }

      const data = await fetchPostseasonData(leagueId, parseInt(season));
      if (!data) {
        return NextResponse.json(
          { success: false, error: 'Postseason data not available or incomplete' },
          { status: 400 }
        );
      }

      const commentary = await generatePostseasonCommentary(data, config);
      return NextResponse.json({ success: true, commentary });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid commentary type. Use: weekly, postseason, or custom' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Commentary generation failed:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// =============================================================================
// FETCH LEAGUE CONTEXT
// =============================================================================

async function fetchLeagueContext(leagueId: string) {
  try {
    // Get league info
    const { data: league } = await supabase
      .from('leagues')
      .select('name, sleeper_league_id')
      .eq('id', leagueId)
      .single();

    // Get managers with context
    const { data: managers } = await supabase
      .from('managers')
      .select('current_username, display_name, nickname, context_notes')
      .eq('league_id', leagueId)
      .eq('is_active', true);

    if (!league) return null;

    return {
      leagueName: league.name || 'Dynasty League',
      format: 'SuperFlex, 0.5 TE Premium',
      scoringType: 'H2H + Median (dual scoring)',
      playoffFormat: '6 teams qualify, seeds 1-2 get byes, weeks 15-17',
      managers: managers?.map((m) => ({
        username: m.current_username,
        displayName: m.display_name || undefined,
        nickname: m.nickname || undefined,
        contextNotes: m.context_notes || undefined,
      })),
    };
  } catch {
    return null;
  }
}

// =============================================================================
// DATA FETCHING HELPERS
// =============================================================================

async function fetchWeeklyData(
  leagueId: string,
  season: number,
  week: number
): Promise<WeeklyCommentaryData> {
  // Get league settings
  const { data: settings } = await supabase
    .from('league_settings_history')
    .select('league_settings')
    .eq('league_id', leagueId)
    .eq('season', season)
    .single();

  const playoffWeekStart = settings?.league_settings?.playoff_week_start || 15;

  // Get matchups for the week
  const { data: matchups } = await supabase
    .from('matchups')
    .select(
      `
      *,
      team1:managers!matchups_team1_manager_id_fkey(id, display_name, current_username),
      team2:managers!matchups_team2_manager_id_fkey(id, display_name, current_username),
      winner:managers!matchups_winner_manager_id_fkey(id, display_name, current_username)
    `
    )
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('week', week);

  // Get weekly scores
  const { data: weeklyScores } = await supabase
    .from('weekly_scores')
    .select(
      `
      *,
      manager:managers!weekly_scores_manager_id_fkey(id, display_name, current_username)
    `
    )
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('week', week)
    .order('weekly_rank', { ascending: true });

  // Get season standings up to this week
  const { data: seasonScores } = await supabase
    .from('weekly_scores')
    .select(
      `
      manager_id,
      points_for,
      h2h_win,
      median_win,
      managers!weekly_scores_manager_id_fkey(id, display_name, current_username)
    `
    )
    .eq('league_id', leagueId)
    .eq('season', season)
    .lte('week', week);

  // Aggregate standings
  const managerStats = new Map<
    string,
    {
      managerId: string;
      name: string;
      combinedWins: number;
      combinedLosses: number;
      pointsFor: number;
    }
  >();

  for (const row of seasonScores || []) {
    const manager = row.managers as {
      id: string;
      display_name: string;
      current_username: string;
    } | null;
    if (!manager) continue;

    const name = manager.display_name || manager.current_username;
    const existing = managerStats.get(row.manager_id) || {
      managerId: row.manager_id,
      name,
      combinedWins: 0,
      combinedLosses: 0,
      pointsFor: 0,
    };

    existing.combinedWins += (row.h2h_win ? 1 : 0) + (row.median_win ? 1 : 0);
    existing.combinedLosses += (row.h2h_win ? 0 : 1) + (row.median_win ? 0 : 1);
    existing.pointsFor += parseFloat(row.points_for) || 0;

    managerStats.set(row.manager_id, existing);
  }

  const standings = Array.from(managerStats.values())
    .sort((a, b) => {
      if (b.combinedWins !== a.combinedWins) return b.combinedWins - a.combinedWins;
      return b.pointsFor - a.pointsFor;
    })
    .map((s, i) => ({ rank: i + 1, ...s }));

  // Build matchup records map for win-loss display
  const recordsMap = new Map(
    standings.map((s) => [s.managerId, `${s.combinedWins}-${s.combinedLosses}`])
  );

  // Calculate week summary
  const scores = (weeklyScores || [])
    .map((s) => parseFloat(s.points_for) || 0)
    .sort((a, b) => b - a);
  const topScorer = weeklyScores?.find((s) => s.weekly_rank === 1);
  const bottomScorer = weeklyScores?.find((s) => s.weekly_rank === (weeklyScores?.length || 10));

  const median =
    scores.length > 0
      ? (scores[Math.floor(scores.length / 2) - 1] + scores[Math.floor(scores.length / 2)]) / 2
      : 0;

  return {
    season,
    week,
    playoffWeekStart,
    summary: {
      median,
      highest: scores[0] || 0,
      lowest: scores[scores.length - 1] || 0,
      topScorer:
        topScorer?.manager?.display_name || topScorer?.manager?.current_username || 'Unknown',
      bottomScorer:
        bottomScorer?.manager?.display_name ||
        bottomScorer?.manager?.current_username ||
        'Unknown',
    },
    matchups: (matchups || []).map((m) => {
      const winnerName = m.winner?.display_name || m.winner?.current_username || 'Unknown';
      const team1Name = m.team1?.display_name || m.team1?.current_username || 'Unknown';
      const team2Name = m.team2?.display_name || m.team2?.current_username || 'Unknown';
      const isTeam1Winner = m.winner_manager_id === m.team1_manager_id;

      return {
        winner: winnerName,
        winnerScore: isTeam1Winner ? parseFloat(m.team1_points) : parseFloat(m.team2_points),
        loser: isTeam1Winner ? team2Name : team1Name,
        loserScore: isTeam1Winner ? parseFloat(m.team2_points) : parseFloat(m.team1_points),
        margin: parseFloat(m.point_differential),
        winnerRecord: recordsMap.get(m.winner_manager_id) || '0-0',
        loserRecord:
          recordsMap.get(isTeam1Winner ? m.team2_manager_id : m.team1_manager_id) || '0-0',
      };
    }),
    standings,
    weeklyScores: (weeklyScores || []).map((s) => ({
      name: s.manager?.display_name || s.manager?.current_username || 'Unknown',
      score: parseFloat(s.points_for) || 0,
      rank: s.weekly_rank,
      allPlayWins: s.allplay_wins || 0,
      allPlayLosses: s.allplay_losses || 0,
    })),
  };
}

async function fetchPostseasonData(
  leagueId: string,
  season: number
): Promise<PostseasonCommentaryData | null> {
  // Fetch from postseason endpoint
  const { data: playoffMatchups } = await supabase
    .from('matchups')
    .select(
      `
      *,
      team1:managers!matchups_team1_manager_id_fkey(id, display_name, current_username),
      team2:managers!matchups_team2_manager_id_fkey(id, display_name, current_username),
      winner:managers!matchups_winner_manager_id_fkey(id, display_name, current_username)
    `
    )
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('is_playoff', true)
    .order('week', { ascending: true });

  if (!playoffMatchups || playoffMatchups.length === 0) {
    return null;
  }

  // Find championship game (highest week, playoff bracket)
  const championshipGame = playoffMatchups
    .filter((m) => !m.is_toilet_bowl)
    .sort((a, b) => b.week - a.week)[0];

  if (!championshipGame || !championshipGame.winner_manager_id) {
    return null; // Postseason not complete
  }

  // Find toilet bowl final (highest week, toilet bowl bracket)
  const toiletBowlFinal = playoffMatchups
    .filter((m) => m.is_toilet_bowl)
    .sort((a, b) => b.week - a.week)[0];

  // Get seedings
  const { data: seedings } = await supabase
    .from('weekly_scores')
    .select(
      `
      manager_id,
      h2h_win,
      median_win,
      points_for,
      managers!weekly_scores_manager_id_fkey(id, display_name, current_username)
    `
    )
    .eq('league_id', leagueId)
    .eq('season', season)
    .lt('week', 15); // Regular season only

  // Calculate seeds
  const managerSeeds = new Map<string, number>();
  if (seedings) {
    const aggregated = new Map<string, { wins: number; pf: number; name: string }>();
    for (const row of seedings) {
      const manager = row.managers as {
        id: string;
        display_name: string;
        current_username: string;
      } | null;
      if (!manager) continue;
      const existing = aggregated.get(row.manager_id) || {
        wins: 0,
        pf: 0,
        name: manager.display_name || manager.current_username,
      };
      existing.wins += (row.h2h_win ? 1 : 0) + (row.median_win ? 1 : 0);
      existing.pf += parseFloat(row.points_for) || 0;
      aggregated.set(row.manager_id, existing);
    }

    const sorted = Array.from(aggregated.entries()).sort((a, b) => {
      if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
      return b[1].pf - a[1].pf;
    });

    sorted.forEach(([id], i) => managerSeeds.set(id, i + 1));
  }

  const getSeed = (managerId: string) => managerSeeds.get(managerId) || 0;
  const getName = (m: { display_name?: string; current_username?: string } | null) =>
    m?.display_name || m?.current_username || 'Unknown';

  // Determine champion and runner-up
  const champion = getName(championshipGame.winner);
  const championId = championshipGame.winner_manager_id;
  const runnerUpId =
    championshipGame.team1_manager_id === championId
      ? championshipGame.team2_manager_id
      : championshipGame.team1_manager_id;
  const runnerUp =
    championshipGame.team1_manager_id === championId
      ? getName(championshipGame.team2)
      : getName(championshipGame.team1);

  // Determine toilet bowl loser (in toilet bowl, loser advances, so final loser is worst)
  let toiletBowlLoser = 'Unknown';
  let toiletBowlLoserId = '';
  if (toiletBowlFinal) {
    toiletBowlLoserId =
      toiletBowlFinal.team1_manager_id === toiletBowlFinal.winner_manager_id
        ? toiletBowlFinal.team2_manager_id
        : toiletBowlFinal.team1_manager_id;
    toiletBowlLoser =
      toiletBowlFinal.team1_manager_id === toiletBowlFinal.winner_manager_id
        ? getName(toiletBowlFinal.team2)
        : getName(toiletBowlFinal.team1);
  }

  // Build playoff matchups for champion's path
  const championMatchups = playoffMatchups
    .filter((m) => m.winner_manager_id === championId && !m.is_toilet_bowl)
    .map((m) => {
      const loserId =
        m.team1_manager_id === championId ? m.team2_manager_id : m.team1_manager_id;
      const loserName =
        m.team1_manager_id === championId ? getName(m.team2) : getName(m.team1);

      let round = 'Round';
      const maxWeek = Math.max(
        ...playoffMatchups.filter((pm) => !pm.is_toilet_bowl).map((pm) => pm.week)
      );
      if (m.week === maxWeek) round = 'Championship';
      else if (m.week === maxWeek - 1) round = 'Semifinal';
      else round = 'Wildcard';

      return {
        round,
        winner: champion,
        winnerSeed: getSeed(championId),
        loser: loserName,
        loserSeed: getSeed(loserId),
        margin: parseFloat(m.point_differential),
      };
    });

  return {
    season,
    champion,
    championSeed: getSeed(championId),
    runnerUp,
    runnerUpSeed: getSeed(runnerUpId),
    toiletBowlLoser,
    toiletBowlLoserSeed: getSeed(toiletBowlLoserId),
    championshipMargin: parseFloat(championshipGame.point_differential),
    playoffMatchups: championMatchups,
  };
}
