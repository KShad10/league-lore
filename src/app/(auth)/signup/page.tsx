'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  
  const router = useRouter()

  // Use production URL for email redirects, fallback to env var or current origin
  const getRedirectUrl = () => {
    // Always use production URL for email links (they might be opened on different devices)
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      return `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
    }
    // Fallback for production deployment
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return `${window.location.origin}/auth/callback`
    }
    // For local dev, still use production so emails work on any device
    return 'https://leaguelore.app/auth/callback'
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    const supabase = createClient()
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getRedirectUrl(),
      },
    })

    if (error) {
      // Handle case where user already exists but is unconfirmed
      if (error.message.includes('already registered')) {
        setError('This email is already registered. Check your email for a confirmation link, or try resending below.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
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
      setSuccess(true)
    }
    
    setResending(false)
  }

  if (success) {
    return (
      <div className="page-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <h2 style={{ color: 'var(--accent-primary)', marginBottom: 'var(--space-md)' }}>Check Your Email</h2>
            <p className="text-muted" style={{ marginBottom: 'var(--space-lg)' }}>
              We&apos;ve sent a confirmation link to <strong>{email}</strong>. 
              Click the link to activate your account.
            </p>
            <p className="text-muted text-sm" style={{ marginBottom: 'var(--space-lg)' }}>
              Tip: Open the email on this device to avoid redirect issues.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <button 
                onClick={handleResendConfirmation}
                className="btn btn-secondary"
                disabled={resending}
              >
                {resending ? 'Sending...' : 'Resend Confirmation Email'}
              </button>
              <Link href="/login">
                <button className="btn btn-ghost" style={{ width: '100%' }}>
                  Return to Login
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
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
          <p className="text-muted text-sm">Create your account</p>
        </header>

        <div className="card">
          <form onSubmit={handleSignup}>
            {error && (
              <div className="info-banner error" style={{ marginBottom: 'var(--space-lg)' }}>
                {error}
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
                autoComplete="new-password"
              />
              <p className="field-hint">Minimum 6 characters</p>
            </div>

            <div className="form-field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: 'var(--space-md)' }}
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          {/* Resend confirmation option */}
          <div style={{ marginTop: 'var(--space-md)', textAlign: 'center' }}>
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resending || !email}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '0.8125rem',
                cursor: email ? 'pointer' : 'not-allowed',
                textDecoration: 'underline',
                opacity: email ? 1 : 0.5
              }}
            >
              {resending ? 'Sending...' : 'Resend confirmation email'}
            </button>
          </div>

          <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border-light)', textAlign: 'center' }}>
            <p className="text-muted text-sm">
              Already have an account?{' '}
              <Link href="/login" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
