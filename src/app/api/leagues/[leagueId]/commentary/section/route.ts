import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { generateSingleCommentary, CommentaryConfig } from '@/lib/ai';
import { VoicePreset, ReportTemplate, PROMPTS } from '@/lib/ai/prompts';

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

// Map section keys to prompt types
const WEEKLY_SECTION_MAP: Record<string, string> = {
  opener: 'weeklyOpener',
  standingsAnalysis: 'standingsAnalysis',
  topPerformerSpotlight: 'topPerformerSpotlight',
  bottomPerformerRoast: 'bottomPerformerRoast',
  playoffPicture: 'playoffPicture',
  closer: 'weeklyCloser',
};

const POSTSEASON_SECTION_MAP: Record<string, string> = {
  recap: 'postseasonRecap',
  championPath: 'championPath',
  toiletBowlSummary: 'toiletBowlSummary',
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params;

  try {
    const supabase = await createClient();
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      type,
      season,
      week,
      voice = 'supreme_leader',
      template = 'standard',
      customVoice,
      section,
    } = body;

    if (!section) {
      return NextResponse.json(
        { success: false, error: 'Section parameter required' },
        { status: 400 }
      );
    }

    // Build config
    const config: CommentaryConfig = {
      voice: voice as VoicePreset,
      template: template as ReportTemplate,
      customVoice: voice === 'custom' ? customVoice : undefined,
    };

    // Fetch league context
    const leagueContext = await fetchLeagueContext(supabase, leagueId);
    if (leagueContext) {
      config.leagueContext = leagueContext;
    }

    let content: string;

    if (type === 'weekly') {
      const promptType = WEEKLY_SECTION_MAP[section];
      if (!promptType) {
        return NextResponse.json(
          { success: false, error: `Unknown section: ${section}` },
          { status: 400 }
        );
      }

      const data = await fetchSectionData(supabase, leagueId, parseInt(season), parseInt(week), section);
      content = await generateSingleCommentary(promptType as keyof typeof PROMPTS, data, config);
    } else if (type === 'postseason') {
      const promptType = POSTSEASON_SECTION_MAP[section];
      if (!promptType) {
        return NextResponse.json(
          { success: false, error: `Unknown section: ${section}` },
          { status: 400 }
        );
      }

      const data = await fetchPostseasonSectionData(supabase, leagueId, parseInt(season), section);
      content = await generateSingleCommentary(promptType as keyof typeof PROMPTS, data, config);
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Use: weekly or postseason' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, content });
  } catch (error) {
    console.error('Section regeneration failed:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// Fetch league context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchLeagueContext(supabase: SupabaseClient<any, any, any>, leagueId: string) {
  try {
    const { data: league } = await supabase
      .from('leagues')
      .select('name')
      .eq('id', leagueId)
      .single();

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

// Fetch data for a specific weekly section
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchSectionData(
  supabase: SupabaseClient<any, any, any>,
  leagueId: string,
  season: number,
  week: number,
  section: string
): Promise<Record<string, unknown>> {
  const { data: settings } = await supabase
    .from('league_settings_history')
    .select('league_settings')
    .eq('league_id', leagueId)
    .eq('season', season)
    .single();

  const playoffWeekStart = settings?.league_settings?.playoff_week_start || 15;

  // Get weekly scores
  const { data: weeklyScores } = await supabase
    .from('weekly_scores')
    .select(`
      *,
      manager:managers!weekly_scores_manager_id_fkey(id, display_name, current_username)
    `)
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('week', week)
    .order('weekly_rank', { ascending: true });

  // Get season standings up to this week
  const { data: seasonScores } = await supabase
    .from('weekly_scores')
    .select(`
      manager_id,
      points_for,
      h2h_win,
      median_win,
      managers!weekly_scores_manager_id_fkey(id, display_name, current_username)
    `)
    .eq('league_id', leagueId)
    .eq('season', season)
    .lte('week', week);

  // Get matchups
  const { data: matchups } = await supabase
    .from('matchups')
    .select(`
      *,
      team1:managers!matchups_team1_manager_id_fkey(id, display_name, current_username),
      team2:managers!matchups_team2_manager_id_fkey(id, display_name, current_username),
      winner:managers!matchups_winner_manager_id_fkey(id, display_name, current_username)
    `)
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('week', week);

  // Calculate standings
  const managerStats = new Map<string, {
    managerId: string;
    name: string;
    combinedWins: number;
    combinedLosses: number;
    pointsFor: number;
  }>();

  for (const row of seasonScores || []) {
    const manager = row.managers as unknown as { display_name: string; current_username: string } | null;
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

  const scores = (weeklyScores || []).map(s => parseFloat(s.points_for) || 0).sort((a, b) => b - a);
  const topScorer = weeklyScores?.find(s => s.weekly_rank === 1);
  const bottomScorer = weeklyScores?.find(s => s.weekly_rank === (weeklyScores?.length || 10));

  const getManagerName = (s: { manager?: unknown } | null) => {
    const mgr = s?.manager as unknown as { display_name?: string; current_username?: string } | null;
    return mgr?.display_name || mgr?.current_username || 'Unknown';
  };

  // Build section-specific data
  switch (section) {
    case 'opener': {
      const sortedByMargin = [...(matchups || [])].sort(
        (a, b) => parseFloat(b.point_differential) - parseFloat(a.point_differential)
      );
      return {
        season,
        week,
        topScorer: getManagerName(topScorer),
        topScore: scores[0] || 0,
        bottomScorer: getManagerName(bottomScorer),
        bottomScore: scores[scores.length - 1] || 0,
        biggestBlowout: parseFloat(sortedByMargin[0]?.point_differential) || 0,
        closestMargin: parseFloat(sortedByMargin[sortedByMargin.length - 1]?.point_differential) || 0,
      };
    }

    case 'standingsAnalysis':
      return {
        season,
        week,
        playoffWeekStart,
        standings: standings.map(s => ({
          rank: s.rank,
          name: s.name,
          combinedWins: s.combinedWins,
          combinedLosses: s.combinedLosses,
          pointsFor: s.pointsFor,
        })),
      };

    case 'topPerformerSpotlight':
      return {
        name: getManagerName(topScorer),
        score: scores[0] || 0,
        rank: 1,
        allPlayRecord: `${topScorer?.allplay_wins || 0}-${topScorer?.allplay_losses || 0}`,
      };

    case 'bottomPerformerRoast':
      return {
        name: getManagerName(bottomScorer),
        score: scores[scores.length - 1] || 0,
        rank: weeklyScores?.length || 10,
        allPlayRecord: `${bottomScorer?.allplay_wins || 0}-${bottomScorer?.allplay_losses || 0}`,
      };

    case 'playoffPicture': {
      const weeksRemaining = playoffWeekStart - week - 1;
      const topSeed = standings[0];
      const currentQualifiers = standings.slice(0, 6);
      const bubbleTeams = standings.slice(5, 8).map(s => ({
        ...s,
        gamesBack: topSeed.combinedWins - s.combinedWins,
      }));
      return {
        week,
        weeksRemaining,
        playoffTeams: 6,
        currentQualifiers: currentQualifiers.map(s => ({
          rank: s.rank,
          name: s.name,
          wins: s.combinedWins,
          pf: s.pointsFor,
        })),
        bubbleTeams: bubbleTeams.map(s => ({
          rank: s.rank,
          name: s.name,
          wins: s.combinedWins,
          pf: s.pointsFor,
          gamesBack: s.gamesBack,
        })),
      };
    }

    case 'closer':
      return {
        week,
        playoffImplications: week >= 10 ? 'Playoff implications intensify.' : undefined,
      };

    default:
      return { season, week };
  }
}

// Fetch data for a specific postseason section
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchPostseasonSectionData(
  supabase: SupabaseClient<any, any, any>,
  leagueId: string,
  season: number,
  section: string
): Promise<Record<string, unknown>> {
  const { data: playoffMatchups } = await supabase
    .from('matchups')
    .select(`
      *,
      team1:managers!matchups_team1_manager_id_fkey(id, display_name, current_username),
      team2:managers!matchups_team2_manager_id_fkey(id, display_name, current_username),
      winner:managers!matchups_winner_manager_id_fkey(id, display_name, current_username)
    `)
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('is_playoff', true)
    .order('week', { ascending: true });

  if (!playoffMatchups || playoffMatchups.length === 0) {
    return { season };
  }

  const championshipGame = playoffMatchups
    .filter(m => !m.is_toilet_bowl)
    .sort((a, b) => b.week - a.week)[0];

  const toiletBowlFinal = playoffMatchups
    .filter(m => m.is_toilet_bowl)
    .sort((a, b) => b.week - a.week)[0];

  // Get seedings
  const { data: seedings } = await supabase
    .from('weekly_scores')
    .select(`
      manager_id,
      h2h_win,
      median_win,
      points_for,
      managers!weekly_scores_manager_id_fkey(id, display_name, current_username)
    `)
    .eq('league_id', leagueId)
    .eq('season', season)
    .lt('week', 15);

  const managerSeeds = new Map<string, number>();
  if (seedings) {
    const aggregated = new Map<string, { wins: number; pf: number }>();
    for (const row of seedings) {
      const existing = aggregated.get(row.manager_id) || { wins: 0, pf: 0 };
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

  const getSeed = (id: string) => managerSeeds.get(id) || 0;
  const getName = (m: { display_name?: string; current_username?: string } | null) =>
    m?.display_name || m?.current_username || 'Unknown';

  const champWinner = championshipGame?.winner as unknown as { display_name?: string; current_username?: string } | null;
  const champTeam1 = championshipGame?.team1 as unknown as { display_name?: string; current_username?: string } | null;
  const champTeam2 = championshipGame?.team2 as unknown as { display_name?: string; current_username?: string } | null;
  
  const champion = getName(champWinner);
  const championId = championshipGame?.winner_manager_id || '';
  const runnerUpId = championshipGame?.team1_manager_id === championId
    ? championshipGame?.team2_manager_id
    : championshipGame?.team1_manager_id;
  const runnerUp = championshipGame?.team1_manager_id === championId
    ? getName(champTeam2)
    : getName(champTeam1);

  let toiletBowlLoser = 'Unknown';
  let toiletBowlLoserId = '';
  if (toiletBowlFinal) {
    const tbTeam1 = toiletBowlFinal.team1 as unknown as { display_name?: string; current_username?: string } | null;
    const tbTeam2 = toiletBowlFinal.team2 as unknown as { display_name?: string; current_username?: string } | null;
    
    toiletBowlLoserId = toiletBowlFinal.team1_manager_id === toiletBowlFinal.winner_manager_id
      ? toiletBowlFinal.team2_manager_id
      : toiletBowlFinal.team1_manager_id;
    toiletBowlLoser = toiletBowlFinal.team1_manager_id === toiletBowlFinal.winner_manager_id
      ? getName(tbTeam2)
      : getName(tbTeam1);
  }

  switch (section) {
    case 'recap':
      return {
        season,
        champion,
        championSeed: getSeed(championId),
        runnerUp,
        runnerUpSeed: getSeed(runnerUpId || ''),
        toiletBowlLoser,
        toiletBowlLoserSeed: getSeed(toiletBowlLoserId),
        championshipMargin: parseFloat(championshipGame?.point_differential) || 0,
      };

    case 'championPath': {
      const championMatchups = playoffMatchups
        .filter(m => m.winner_manager_id === championId && !m.is_toilet_bowl)
        .map(m => {
          const mTeam1 = m.team1 as unknown as { display_name?: string; current_username?: string } | null;
          const mTeam2 = m.team2 as unknown as { display_name?: string; current_username?: string } | null;
          
          const loserId = m.team1_manager_id === championId ? m.team2_manager_id : m.team1_manager_id;
          const loserName = m.team1_manager_id === championId ? getName(mTeam2) : getName(mTeam1);
          const maxWeek = Math.max(...playoffMatchups.filter(pm => !pm.is_toilet_bowl).map(pm => pm.week));
          let round = 'Round';
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
        champion,
        championSeed: getSeed(championId),
        playoffMatchups: championMatchups,
      };
    }

    case 'toiletBowlSummary':
      return {
        toiletBowlLoser,
        toiletBowlLoserSeed: getSeed(toiletBowlLoserId),
      };

    default:
      return { season };
  }
}
