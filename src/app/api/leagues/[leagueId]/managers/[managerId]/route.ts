import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ leagueId: string; managerId: string }>
}

interface UpdateManagerRequest {
  display_name?: string
  nickname?: string
  context_notes?: string
  rivalry_notes?: Record<string, string>
}

// GET single manager
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { leagueId, managerId } = await params
  
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
    
    const { data, error } = await supabase
      .from('managers')
      .select('*')
      .eq('id', managerId)
      .eq('league_id', leagueId)
      .single()
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      manager: {
        id: data.id,
        sleeperUserId: data.sleeper_user_id,
        sleeperRosterId: data.sleeper_roster_id,
        username: data.current_username,
        displayName: data.display_name,
        nickname: data.nickname,
        avatarUrl: data.avatar_url,
        contextNotes: data.context_notes,
        rivalryNotes: data.rivalry_notes,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    })
    
  } catch (error) {
    console.error('Get manager failed:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

// UPDATE manager
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { leagueId, managerId } = await params
  
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
    
    const body: UpdateManagerRequest = await request.json()
    
    // Validate the manager belongs to this league (and user owns the league via RLS)
    const { data: existing, error: checkError } = await supabase
      .from('managers')
      .select('id')
      .eq('id', managerId)
      .eq('league_id', leagueId)
      .single()
    
    if (checkError || !existing) {
      console.error('Manager check error:', checkError)
      return NextResponse.json(
        { success: false, error: 'Manager not found' },
        { status: 404 }
      )
    }
    
    // Build update object with only provided fields
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    
    if (body.display_name !== undefined) {
      updates.display_name = body.display_name || null
    }
    if (body.nickname !== undefined) {
      updates.nickname = body.nickname || null
    }
    if (body.context_notes !== undefined) {
      updates.context_notes = body.context_notes || null
    }
    if (body.rivalry_notes !== undefined) {
      updates.rivalry_notes = body.rivalry_notes || null
    }
    
    const { data, error } = await supabase
      .from('managers')
      .update(updates)
      .eq('id', managerId)
      .eq('league_id', leagueId)
      .select()
      .single()
    
    if (error) {
      console.error('Manager update error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      manager: {
        id: data.id,
        sleeperUserId: data.sleeper_user_id,
        sleeperRosterId: data.sleeper_roster_id,
        username: data.current_username,
        displayName: data.display_name,
        nickname: data.nickname,
        avatarUrl: data.avatar_url,
        contextNotes: data.context_notes,
        rivalryNotes: data.rivalry_notes,
        isActive: data.is_active,
        updatedAt: data.updated_at,
      },
    })
    
  } catch (error) {
    console.error('Update manager failed:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
