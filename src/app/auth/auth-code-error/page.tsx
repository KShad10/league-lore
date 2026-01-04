'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
      <h1 style={{ 
        color: 'var(--accent-secondary)', 
        fontSize: '1.5rem', 
        marginBottom: 'var(--space-md)' 
      }}>
        Authentication Error
      </h1>
      <p className="text-muted" style={{ marginBottom: 'var(--space-md)' }}>
        There was an error confirming your account.
        The link may have expired or already been used.
      </p>
      {error && (
        <p className="text-muted text-sm" style={{ 
          marginBottom: 'var(--space-xl)',
          padding: 'var(--space-md)',
          background: 'var(--surface-sunken)',
          border: '1px solid var(--border-light)',
          fontFamily: 'var(--font-sans)'
        }}>
          Debug: {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
        <Link href="/signup">
          <button className="btn btn-secondary">Try Again</button>
        </Link>
        <Link href="/login">
          <button className="btn btn-primary">Sign In</button>
        </Link>
      </div>
    </div>
  )
}

export default function AuthCodeErrorPage() {
  return (
    <div className="page-container" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center' 
    }}>
      <Suspense fallback={
        <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <p className="text-muted">Loading...</p>
        </div>
      }>
        <ErrorContent />
      </Suspense>
    </div>
  )
}
