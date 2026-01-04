import { NextRequest, NextResponse } from 'next/server';
import { generatePostseasonReport, PostseasonReportData } from '@/lib/reports';

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params;
  const { searchParams } = new URL(request.url);
  const season = searchParams.get('season');
  const format = searchParams.get('format') || 'html'; // html or json
  
  if (!season) {
    return NextResponse.json(
      { success: false, error: 'Season parameter is required' },
      { status: 400 }
    );
  }
  
  try {
    // Fetch postseason data from existing endpoint
    const baseUrl = request.nextUrl.origin;
    const postseasonResponse = await fetch(
      `${baseUrl}/api/leagues/${leagueId}/postseason?season=${season}`
    );
    
    if (!postseasonResponse.ok) {
      throw new Error('Failed to fetch postseason data');
    }
    
    const postseasonData = await postseasonResponse.json();
    
    if (!postseasonData.success) {
      throw new Error(postseasonData.error || 'Unknown error');
    }
    
    // Determine if postseason is complete
    const hasChampion = !!postseasonData.summary.champion;
    const hasToiletBowlLoser = !!postseasonData.summary.toiletBowlLoser;
    const isComplete = hasChampion && hasToiletBowlLoser;
    
    // Build report data
    const reportData: PostseasonReportData = {
      season: postseasonData.season,
      settings: postseasonData.settings,
      seedings: postseasonData.seedings,
      summary: postseasonData.summary,
      playoff: postseasonData.playoff,
      placeGames: postseasonData.placeGames,
      toiletBowl: postseasonData.toiletBowl,
      isComplete,
    };
    
    // Return based on format
    if (format === 'json') {
      return NextResponse.json({ success: true, data: reportData });
    }
    
    // Generate HTML report
    const htmlReport = generatePostseasonReport(reportData);
    
    return new NextResponse(htmlReport, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
    
  } catch (error) {
    console.error('Postseason report generation failed:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
