import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check if user has any leagues
  const { data: leagues } = await supabase
    .from('leagues')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  // If no leagues, redirect to onboarding
  if (!leagues || leagues.length === 0) {
    redirect('/onboarding')
  }

  // If has leagues, go to stats
  redirect('/dashboard/stats')
}
