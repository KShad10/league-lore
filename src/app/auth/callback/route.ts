import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
    
    console.error('Auth callback error:', error.message)
    const errorUrl = new URL(`${origin}/auth/auth-code-error`)
    errorUrl.searchParams.set('error', error.message)
    return NextResponse.redirect(errorUrl.toString())
  }

  const errorUrl = new URL(`${origin}/auth/auth-code-error`)
  errorUrl.searchParams.set('error', 'No code provided')
  return NextResponse.redirect(errorUrl.toString())
}
