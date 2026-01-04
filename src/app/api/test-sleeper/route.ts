import { NextResponse } from 'next/server';
import { getLeagueSeasonData, getLeagueHistory, getNflState } from '@/lib/sleeper';

// OG Papio Dynasty League ID (2025 season)
const TEST_LEAGUE_ID = '1180652924551106560';

export async function GET() {
  try {
    // Fetch NFL state
    const nflState = await getNflState();
    
    // Fetch current season data
    const seasonData = await getLeagueSeasonData(TEST_LEAGUE_ID);
    
    // Fetch league history (all seasons)
    const history = await getLeagueHistory(TEST_LEAGUE_ID);
    
    return NextResponse.json({
      success: true,
      nflState,
      currentSeason: {
        league: seasonData.league,
        userCount: seasonData.users.length,
        rosterCount: seasonData.rosters.length,
        users: seasonData.users.map(u => u.displayName),
      },
      leagueHistory: history.map(l => ({
        season: l.season,
        name: l.name,
        leagueId: l.leagueId,
      })),
    });
  } catch (error) {
    console.error('Sleeper API test failed:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
