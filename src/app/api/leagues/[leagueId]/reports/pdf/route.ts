import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generatePdfFromHtml } from '@/lib/pdf/puppeteer';
import type { LeagueRouteParams } from '@/lib/api/types';

/**
 * POST /api/leagues/[leagueId]/reports/pdf
 *
 * Generate a PDF from HTML content
 *
 * Request body:
 * - html: Complete HTML document string
 * - filename?: Output filename (default: 'report.pdf')
 * - format?: 'letter' | 'a4' (default: 'letter')
 *
 * Returns: PDF file as binary download
 */
export async function POST(request: NextRequest, { params }: LeagueRouteParams) {
  const { leagueId } = await params;

  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Verify league access
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('id', leagueId)
      .single();

    if (leagueError || !league) {
      return NextResponse.json({ success: false, error: 'League not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { html, filename = 'report.pdf', format = 'letter' } = body;

    if (!html) {
      return NextResponse.json(
        { success: false, error: 'HTML content is required' },
        { status: 400 }
      );
    }

    // Generate PDF
    const pdfBuffer = await generatePdfFromHtml(html, {
      format: format as 'letter' | 'a4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.7in',
        bottom: '0.8in',
        left: '0.7in',
      },
    });

    // Return PDF as download
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('PDF generation failed:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leagues/[leagueId]/reports/pdf
 *
 * Generate PDF from a report URL
 *
 * Query params:
 * - type: 'weekly' | 'postseason'
 * - season: number
 * - week?: number (required for weekly)
 * - format?: 'letter' | 'a4'
 *
 * Returns: PDF file as binary download
 */
export async function GET(request: NextRequest, { params }: LeagueRouteParams) {
  const { leagueId } = await params;
  const { searchParams } = new URL(request.url);
  const reportType = searchParams.get('type');
  const season = searchParams.get('season');
  const week = searchParams.get('week');
  const format = (searchParams.get('format') || 'letter') as 'letter' | 'a4';

  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!reportType || !season) {
      return NextResponse.json(
        { success: false, error: 'Report type and season are required' },
        { status: 400 }
      );
    }

    if (reportType === 'weekly' && !week) {
      return NextResponse.json(
        { success: false, error: 'Week is required for weekly reports' },
        { status: 400 }
      );
    }

    // Build report URL
    const baseUrl = request.headers.get('host') || 'localhost:3000';
    const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
    let reportUrl = `${protocol}://${baseUrl}/api/leagues/${leagueId}/reports/${reportType}?season=${season}&format=html`;
    if (week) {
      reportUrl += `&week=${week}`;
    }

    // Fetch HTML report
    const reportResponse = await fetch(reportUrl, {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    });

    if (!reportResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch report' },
        { status: 500 }
      );
    }

    const html = await reportResponse.text();

    // Generate PDF
    const pdfBuffer = await generatePdfFromHtml(html, {
      format,
      printBackground: true,
    });

    // Generate filename
    const filename = reportType === 'weekly'
      ? `weekly-report-${season}-week-${week}.pdf`
      : `postseason-report-${season}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('PDF generation failed:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
