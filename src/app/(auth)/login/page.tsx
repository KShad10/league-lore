'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showResend, setShowResend] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  const getRedirectUrl = () => {
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      return `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
    }
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return `${window.location.origin}/auth/callback`
    }
    return 'https://leaguelore.app/auth/callback'
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setShowResend(false)
    setResendSuccess(false)

    const supabase = createClient()
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Check if the error is about email not confirmed
      if (error.message.includes('Email not confirmed')) {
        setError('Please confirm your email before signing in.')
        setShowResend(true)
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('Please enter your email address first')
      return
    }

    setResending(true)
    setError(null)

    const supabase = createClient()
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: getRedirectUrl(),
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setResendSuccess(true)
      setShowResend(false)
    }
    
    setResending(false)
  }

  return (
    <div className="page-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <header style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)', color: 'var(--accent-primary)' }}>
              League Lore
            </h1>
          </Link>
          <p className="text-muted text-sm">Sign in to your account</p>
        </header>

        <div className="card">
          <form onSubmit={handleLogin}>
            {error && (
              <div className="info-banner error" style={{ marginBottom: 'var(--space-lg)' }}>
                {error}
              </div>
            )}

            {resendSuccess && (
              <div className="info-banner" style={{ marginBottom: 'var(--space-lg)', borderLeftColor: 'var(--win)' }}>
                Confirmation email sent! Check your inbox and open the link on this device.
              </div>
            )}

            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: 'var(--space-md)' }}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            {showResend && (
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resending}
                className="btn btn-secondary"
                style={{ width: '100%', marginTop: 'var(--space-md)' }}
              >
                {resending ? 'Sending...' : 'Resend Confirmation Email'}
              </button>
            )}
          </form>

          <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border-light)', textAlign: 'center' }}>
            <p className="text-muted text-sm">
              Don&apos;t have an account?{' '}
              <Link href="/signup" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
