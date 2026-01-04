import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

// =============================================================================
// TYPES
// =============================================================================

interface PlayoffConfig {
  playoffWeekStart: number;
  playoffTeams: number;
  totalRosters: number;
  toiletBowlTeams: number;
  // Format settings
  playoffRoundType: number;   // 0=one week, 1=two week champ, 2=two weeks all
  playoffSeedType: number;    // 0=default brackets, 1=re-seed each round
  playoffType: number;        // 0=standard, 1=two weeks per matchup
  loserBracketType: number;   // 0=toilet bowl (losers advance), 1=consolation (winners advance)
}

interface MatchupData {
  id: string;
  week: number;
  matchupId: number;
  team1ManagerId: string;
  team2ManagerId: string;
  team1Points: number;
  team2Points: number;
  winnerManagerId: string;
  team1Name: string;
  team2Name: string;
  winnerName: string;
  pointDifferential: number;
}

interface TeamMatchupInfo {
  managerId: string;
  name: string;
  seed: number;
  points: number;
  isWinner: boolean;
}

interface FormattedMatchup {
  id: string;
  week: number;
  matchupId: number;
  matchupType: string;
  bracketType: 'playoff' | 'toilet_bowl' | 'place_game';
  roundNumber: number;
  isTwoWeekMatchup: boolean;
  aggregatePoints?: { team1: number; team2: number };
  team1: TeamMatchupInfo;
  team2: TeamMatchupInfo;
  pointDifferential: number;
  winnerName: string;
  winnerSeed: number;
}

interface Seeding {
  seed: number;
  managerId: string;
  name: string;
  combinedWins: number;
  pointsFor: number;
  bracket: 'playoff' | 'toilet_bowl';
  hasBye: boolean;
}

interface BracketRound {
  name: string;
  week: number;
  weekSpan?: [number, number];  // For two-week matchups
  matchups: FormattedMatchup[];
  byes?: Array<{ seed: number; name: string; managerId: string }>;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params;
  const { searchParams } = new URL(request.url);
  const season = searchParams.get('season');
  
  if (!season) {
    return NextResponse.json(
      { success: false, error: 'Season parameter is required' },
      { status: 400 }
    );
  }
  
  try {
    // 1. Get league settings for this season
    const config = await getPlayoffConfig(leagueId, parseInt(season));
    
    // 2. Calculate seeds from regular season standings
    const { seedings, seedMap, nameMap } = await calculateSeedings(
      leagueId,
      parseInt(season),
      config
    );
    
    // 3. Get and classify playoff matchups
    const matchups = await getPlayoffMatchups(leagueId, parseInt(season));
    const classifiedMatchups = classifyMatchups(matchups, seedMap, nameMap, config);
    
    // 4. Group matchups into bracket structures
    const { playoffBracket, placeGames, toiletBowl } = groupByBracket(
      classifiedMatchups,
      config,
      seedings
    );
    
    // 5. Determine outcomes
    const summary = determineSummary(classifiedMatchups, config);
    
    return NextResponse.json({
      success: true,
      leagueId,
      season: parseInt(season),
      settings: {
        playoffWeekStart: config.playoffWeekStart,
        playoffTeams: config.playoffTeams,
        totalRosters: config.totalRosters,
        toiletBowlTeams: config.toiletBowlTeams,
        // Format descriptors
        format: {
          roundType: formatRoundType(config.playoffRoundType),
          seedType: config.playoffSeedType === 1 ? 're-seed' : 'fixed-bracket',
          lowerBracket: config.loserBracketType === 1 ? 'consolation' : 'toilet-bowl',
        },
      },
      seedings,
      summary,
      playoff: {
        rounds: playoffBracket,
      },
      placeGames: {
        rounds: placeGames,
      },
      toiletBowl: {
        rounds: toiletBowl,
      },
    });
    
  } catch (error) {
    console.error('Postseason query failed:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function getPlayoffConfig(leagueId: string, season: number): Promise<PlayoffConfig> {
  const { data: settings } = await supabase
    .from('league_settings_history')
    .select('league_settings, scoring_settings')
    .eq('league_id', leagueId)
    .eq('season', season)
    .single();
  
  const ls = settings?.league_settings || {};
  
  const playoffWeekStart = ls.playoff_week_start || settings?.scoring_settings?.playoff_week_start || 15;
  const playoffTeams = ls.playoff_teams || 6;
  const totalRosters = ls.total_rosters || 10;
  
  return {
    playoffWeekStart,
    playoffTeams,
    totalRosters,
    toiletBowlTeams: totalRosters - playoffTeams,
    // Format settings with defaults
    playoffRoundType: ls.playoff_round_type ?? 0,
    playoffSeedType: ls.playoff_seed_type ?? 0,
    playoffType: ls.playoff_type ?? 0,
    loserBracketType: ls.loser_bracket_type ?? 0,
  };
}

async function calculateSeedings(
  leagueId: string,
  season: number,
  config: PlayoffConfig
): Promise<{
  seedings: Seeding[];
  seedMap: Map<string, number>;
  nameMap: Map<string, string>;
}> {
  // Get regular season (before playoffs) standings
  const { data: standingsData, error } = await supabase
    .from('weekly_scores')
    .select(`
      manager_id,
      points_for,
      h2h_win,
      median_win,
      managers!weekly_scores_manager_id_fkey(current_username, display_name)
    `)
    .eq('league_id', leagueId)
    .eq('season', season)
    .lt('week', config.playoffWeekStart);
  
  if (error) throw error;
  
  // Aggregate by manager
  const managerStats = new Map<string, {
    managerId: string;
    name: string;
    combinedWins: number;
    pointsFor: number;
  }>();
  
  for (const row of standingsData) {
    const manager = row.managers as unknown as { current_username: string; display_name: string } | null;
    const existing = managerStats.get(row.manager_id) || {
      managerId: row.manager_id,
      name: manager?.display_name || manager?.current_username || 'Unknown',
      combinedWins: 0,
      pointsFor: 0,
    };
    
    existing.combinedWins += (row.h2h_win ? 1 : 0) + (row.median_win ? 1 : 0);
    existing.pointsFor += parseFloat(row.points_for) || 0;
    managerStats.set(row.manager_id, existing);
  }
  
  // Sort: Combined wins DESC, then Points For DESC
  const sortedManagers = Array.from(managerStats.values()).sort((a, b) => {
    if (b.combinedWins !== a.combinedWins) return b.combinedWins - a.combinedWins;
    return b.pointsFor - a.pointsFor;
  });
  
  const seedMap = new Map<string, number>();
  const nameMap = new Map<string, string>();
  
  // Determine which seeds get byes
  const byeSeeds = getByeSeeds(config.playoffTeams);
  
  const seedings: Seeding[] = sortedManagers.map((m, i) => {
    const seed = i + 1;
    seedMap.set(m.managerId, seed);
    nameMap.set(m.managerId, m.name);
    
    return {
      seed,
      managerId: m.managerId,
      name: m.name,
      combinedWins: m.combinedWins,
      pointsFor: Math.round(m.pointsFor * 100) / 100,
      bracket: seed <= config.playoffTeams ? 'playoff' : 'toilet_bowl',
      hasBye: byeSeeds.includes(seed),
    };
  });
  
  return { seedings, seedMap, nameMap };
}

function getByeSeeds(playoffTeams: number): number[] {
  // Standard bye configurations
  switch (playoffTeams) {
    case 6: return [1, 2];        // 6 teams = 2 byes
    case 8: return [];             // 8 teams = no byes
    case 4: return [];             // 4 teams = no byes
    case 2: return [];             // 2 teams = no byes
    default: return [1, 2];        // Default: top 2 get byes
  }
}

async function getPlayoffMatchups(leagueId: string, season: number): Promise<MatchupData[]> {
  const { data: matchups, error } = await supabase
    .from('matchups')
    .select(`
      *,
      team1:managers!matchups_team1_manager_id_fkey(current_username, display_name),
      team2:managers!matchups_team2_manager_id_fkey(current_username, display_name),
      winner:managers!matchups_winner_manager_id_fkey(current_username, display_name)
    `)
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('is_playoff', true)
    .order('week', { ascending: true })
    .order('matchup_id', { ascending: true });
  
  if (error) throw error;
  
  return matchups.map(m => ({
    id: m.id,
    week: m.week,
    matchupId: m.matchup_id,
    team1ManagerId: m.team1_manager_id,
    team2ManagerId: m.team2_manager_id,
    team1Points: parseFloat(m.team1_points),
    team2Points: parseFloat(m.team2_points),
    winnerManagerId: m.winner_manager_id,
    team1Name: m.team1?.display_name || m.team1?.current_username || 'Unknown',
    team2Name: m.team2?.display_name || m.team2?.current_username || 'Unknown',
    winnerName: m.winner?.display_name || m.winner?.current_username || 'Unknown',
    pointDifferential: parseFloat(m.point_differential),
  }));
}

function classifyMatchups(
  matchups: MatchupData[],
  seedMap: Map<string, number>,
  nameMap: Map<string, string>,
  config: PlayoffConfig
): FormattedMatchup[] {
  // Track bracket state
  const playoffLosers = new Set<string>();
  const lowerBracketEliminated = new Set<string>(); // For toilet bowl: losers who already lost
  
  // For two-week matchups, track aggregate scores
  const twoWeekAggregates = new Map<string, { team1: number; team2: number; week1: MatchupData }>();
  
  // Sort by week
  const sortedMatchups = [...matchups].sort((a, b) => a.week - b.week);
  
  const result: FormattedMatchup[] = [];
  
  for (const m of sortedMatchups) {
    const seed1 = seedMap.get(m.team1ManagerId) || 99;
    const seed2 = seedMap.get(m.team2ManagerId) || 99;
    const winnerSeed = seedMap.get(m.winnerManagerId) || 0;
    const loserManagerId = m.winnerManagerId === m.team1ManagerId ? m.team2ManagerId : m.team1ManagerId;
    
    // Determine bracket type based on seeds
    const isLowerBracket = seed1 > config.playoffTeams && seed2 > config.playoffTeams;
    const isPlaceGame = !isLowerBracket && 
      playoffLosers.has(m.team1ManagerId) && playoffLosers.has(m.team2ManagerId);
    
    // Calculate round number
    const roundNumber = m.week - config.playoffWeekStart + 1;
    
    // Determine matchup type and bracket
    let matchupType = '';
    let bracketType: 'playoff' | 'toilet_bowl' | 'place_game' = 'playoff';
    let isTwoWeekMatchup = false;
    
    if (isLowerBracket) {
      bracketType = 'toilet_bowl';
      matchupType = getToiletBowlMatchupType(
        roundNumber,
        config,
        m.team1ManagerId,
        m.team2ManagerId,
        lowerBracketEliminated
      );
      
      // In toilet bowl, the LOSER advances (gets punished next round)
      if (config.loserBracketType === 0) {
        // Toilet bowl: loser "advances" to next round
        lowerBracketEliminated.add(m.winnerManagerId); // Winner is safe
      } else {
        // Consolation: winner advances, loser eliminated
        lowerBracketEliminated.add(loserManagerId);
      }
      
    } else if (isPlaceGame) {
      bracketType = 'place_game';
      matchupType = getPlaceGameType(roundNumber, seedMap, m.team1ManagerId, m.team2ManagerId);
      
    } else {
      // Main playoff bracket
      bracketType = 'playoff';
      matchupType = getPlayoffMatchupType(roundNumber, config);
      
      // Check for two-week matchups
      isTwoWeekMatchup = isTwoWeekRound(roundNumber, config);
      
      // Track playoff losers
      playoffLosers.add(loserManagerId);
    }
    
    result.push({
      id: m.id,
      week: m.week,
      matchupId: m.matchupId,
      matchupType,
      bracketType,
      roundNumber,
      isTwoWeekMatchup,
      team1: {
        managerId: m.team1ManagerId,
        name: m.team1Name,
        seed: seed1,
        points: m.team1Points,
        isWinner: m.winnerManagerId === m.team1ManagerId,
      },
      team2: {
        managerId: m.team2ManagerId,
        name: m.team2Name,
        seed: seed2,
        points: m.team2Points,
        isWinner: m.winnerManagerId === m.team2ManagerId,
      },
      pointDifferential: m.pointDifferential,
      winnerName: m.winnerName,
      winnerSeed,
    });
  }
  
  return result;
}

function getPlayoffMatchupType(round: number, config: PlayoffConfig): string {
  const { playoffTeams, playoffRoundType } = config;
  
  // Calculate total rounds needed
  let totalRounds: number;
  if (playoffTeams <= 2) totalRounds = 1;
  else if (playoffTeams <= 4) totalRounds = 2;
  else if (playoffTeams <= 8) totalRounds = 3;
  else totalRounds = 4;
  
  // For two-week championship, the final round spans two weeks
  if (playoffRoundType === 1 && round >= totalRounds) {
    return 'Championship';
  }
  
  // For two weeks per round, adjust round calculation
  if (playoffRoundType === 2) {
    const effectiveRound = Math.ceil(round / 2);
    return getRoundName(effectiveRound, totalRounds, playoffTeams);
  }
  
  return getRoundName(round, totalRounds, playoffTeams);
}

function getRoundName(round: number, totalRounds: number, playoffTeams: number): string {
  const roundsFromEnd = totalRounds - round + 1;
  
  if (roundsFromEnd === 1) return 'Championship';
  if (roundsFromEnd === 2) return 'Semifinal';
  if (roundsFromEnd === 3) {
    if (playoffTeams >= 8) return 'Quarterfinal';
    return 'Wildcard';
  }
  if (roundsFromEnd === 4) return 'Wildcard';
  
  return `Round ${round}`;
}

function getToiletBowlMatchupType(
  round: number,
  config: PlayoffConfig,
  team1Id: string,
  team2Id: string,
  eliminated: Set<string>
): string {
  const isConsolation = config.loserBracketType === 1;
  const bracketName = isConsolation ? 'Consolation' : 'Toilet Bowl';
  
  // For 4-team lower bracket: Round 1 (2 games), then Final
  if (config.toiletBowlTeams === 4) {
    if (round === 1) return `${bracketName} Round 1`;
    
    // In toilet bowl, check if both teams are "losers advancing" or "winners for place"
    const team1Lost = !eliminated.has(team1Id);
    const team2Lost = !eliminated.has(team2Id);
    
    if (isConsolation) {
      if (team1Lost && team2Lost) {
        return '9th Place'; // Both lost round 1
      }
      return '7th Place'; // Both won round 1
    } else {
      // Toilet bowl logic
      if (team1Lost && team2Lost) {
        return 'Last Place'; // Both losers advancing
      }
      return '8th Place'; // Winners playing for not-last
    }
  }
  
  return `${bracketName} Round ${round}`;
}

function getPlaceGameType(
  round: number,
  seedMap: Map<string, number>,
  team1Id: string,
  team2Id: string
): string {
  // Determine place based on typical bracket structure
  if (round === 2) return '5th Place';
  if (round === 3) return '3rd Place';
  return 'Place Game';
}

function isTwoWeekRound(round: number, config: PlayoffConfig): boolean {
  const { playoffRoundType, playoffTeams } = config;
  
  // Calculate total rounds
  let totalRounds: number;
  if (playoffTeams <= 2) totalRounds = 1;
  else if (playoffTeams <= 4) totalRounds = 2;
  else if (playoffTeams <= 8) totalRounds = 3;
  else totalRounds = 4;
  
  if (playoffRoundType === 1) {
    // Two-week championship only
    return round >= totalRounds;
  }
  
  if (playoffRoundType === 2) {
    // Two weeks per round (all rounds)
    return true;
  }
  
  return false;
}

function formatRoundType(roundType: number): string {
  switch (roundType) {
    case 0: return 'one-week-per-round';
    case 1: return 'two-week-championship';
    case 2: return 'two-weeks-per-round';
    default: return 'one-week-per-round';
  }
}

function groupByBracket(
  matchups: FormattedMatchup[],
  config: PlayoffConfig,
  seedings: Seeding[]
): {
  playoffBracket: Record<string, BracketRound>;
  placeGames: Record<string, BracketRound>;
  toiletBowl: Record<string, BracketRound>;
} {
  const playoffBracket: Record<string, BracketRound> = {};
  const placeGames: Record<string, BracketRound> = {};
  const toiletBowl: Record<string, BracketRound> = {};
  
  for (const m of matchups) {
    const target = m.bracketType === 'playoff' ? playoffBracket :
                   m.bracketType === 'place_game' ? placeGames : toiletBowl;
    
    const weekKey = String(m.week);
    
    if (!target[weekKey]) {
      target[weekKey] = {
        name: m.matchupType,
        week: m.week,
        matchups: [],
      };
    }
    
    target[weekKey].matchups.push(m);
  }
  
  // Add bye information to first playoff round
  const byeSeeds = getByeSeeds(config.playoffTeams);
  if (byeSeeds.length > 0) {
    const firstWeekKey = String(config.playoffWeekStart);
    if (playoffBracket[firstWeekKey]) {
      playoffBracket[firstWeekKey].byes = seedings
        .filter(s => byeSeeds.includes(s.seed))
        .map(s => ({ seed: s.seed, name: s.name, managerId: s.managerId }));
    }
  }
  
  return { playoffBracket, placeGames, toiletBowl };
}

function determineSummary(matchups: FormattedMatchup[], config: PlayoffConfig): {
  champion: string | null;
  championSeed: number;
  runnerUp: string | null;
  runnerUpSeed: number;
  toiletBowlLoser: string | null;
  toiletBowlLoserSeed: number;
  thirdPlace: string | null;
  thirdPlaceSeed: number;
} {
  let champion = null, championSeed = 0;
  let runnerUp = null, runnerUpSeed = 0;
  let toiletBowlLoser = null, toiletBowlLoserSeed = 0;
  let thirdPlace = null, thirdPlaceSeed = 0;
  
  // Find championship game
  const championshipGame = matchups.find(m => m.matchupType === 'Championship');
  if (championshipGame) {
    if (championshipGame.team1.isWinner) {
      champion = championshipGame.team1.name;
      championSeed = championshipGame.team1.seed;
      runnerUp = championshipGame.team2.name;
      runnerUpSeed = championshipGame.team2.seed;
    } else if (championshipGame.team2.isWinner) {
      champion = championshipGame.team2.name;
      championSeed = championshipGame.team2.seed;
      runnerUp = championshipGame.team1.name;
      runnerUpSeed = championshipGame.team1.seed;
    }
  }
  
  // Find 3rd place game
  const thirdPlaceGame = matchups.find(m => m.matchupType === '3rd Place');
  if (thirdPlaceGame) {
    if (thirdPlaceGame.team1.isWinner) {
      thirdPlace = thirdPlaceGame.team1.name;
      thirdPlaceSeed = thirdPlaceGame.team1.seed;
    } else if (thirdPlaceGame.team2.isWinner) {
      thirdPlace = thirdPlaceGame.team2.name;
      thirdPlaceSeed = thirdPlaceGame.team2.seed;
    }
  }
  
  // Find toilet bowl final (last place game)
  const toiletFinal = matchups.find(m => 
    m.matchupType === 'Last Place' || 
    m.matchupType === 'Toilet Bowl Final'
  );
  if (toiletFinal) {
    // In toilet bowl, the LOSER gets punished
    if (toiletFinal.team1.isWinner) {
      toiletBowlLoser = toiletFinal.team2.name;
      toiletBowlLoserSeed = toiletFinal.team2.seed;
    } else if (toiletFinal.team2.isWinner) {
      toiletBowlLoser = toiletFinal.team1.name;
      toiletBowlLoserSeed = toiletFinal.team1.seed;
    }
  }
  
  return {
    champion,
    championSeed,
    runnerUp,
    runnerUpSeed,
    toiletBowlLoser,
    toiletBowlLoserSeed,
    thirdPlace,
    thirdPlaceSeed,
  };
}
