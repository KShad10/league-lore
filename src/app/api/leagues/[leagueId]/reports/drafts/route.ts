import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ leagueId: string }>
}

// POST - Save or update a draft
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params
  
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { season, week, reportType, html, config } = body
    
    if (!season || !reportType || !html) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: season, reportType, html' },
        { status: 400 }
      )
    }
    
    // Upsert draft (update if exists, insert if not)
    const { data, error } = await supabase
      .from('report_drafts')
      .upsert({
        league_id: leagueId,
        user_id: user.id,
        season,
        week: week || null,
        report_type: reportType,
        html_content: html,
        config: config || {},
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'league_id,user_id,season,week,report_type',
      })
      .select()
      .single()
    
    if (error) {
      console.error('Draft save error:', error)
      return NextResponse.json(
        { success: false, error: `Failed to save draft: ${error.message}` },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, draft: data })
    
  } catch (error) {
    console.error('Draft save failed:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

// GET - Load a draft
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params
  const { searchParams } = new URL(request.url)
  const season = searchParams.get('season')
  const week = searchParams.get('week')
  const reportType = searchParams.get('reportType') || 'weekly'
  
  if (!season) {
    return NextResponse.json(
      { success: false, error: 'Season parameter is required' },
      { status: 400 }
    )
  }
  
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    let query = supabase
      .from('report_drafts')
      .select('*')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .eq('season', parseInt(season))
      .eq('report_type', reportType)
    
    if (week) {
      query = query.eq('week', parseInt(week))
    } else {
      query = query.is('week', null)
    }
    
    const { data, error } = await query.single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Draft load error:', error)
      return NextResponse.json(
        { success: false, error: `Failed to load draft: ${error.message}` },
        { status: 500 }
      )
    }
    
    if (!data) {
      return NextResponse.json(
        { success: true, draft: null },
        { status: 200 }
      )
    }
    
    return NextResponse.json({ success: true, draft: data })
    
  } catch (error) {
    console.error('Draft load failed:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

// DELETE - Delete a draft
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { leagueId } = await params
  const { searchParams } = new URL(request.url)
  const draftId = searchParams.get('id')
  
  if (!draftId) {
    return NextResponse.json(
      { success: false, error: 'Draft ID is required' },
      { status: 400 }
    )
  }
  
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { error } = await supabase
      .from('report_drafts')
      .delete()
      .eq('id', draftId)
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
    
    if (error) {
      console.error('Draft delete error:', error)
      return NextResponse.json(
        { success: false, error: `Failed to delete draft: ${error.message}` },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Draft delete failed:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
