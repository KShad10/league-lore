'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function UserMenu() {
  const [email, setEmail] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null)
    })
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (!email) return null

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(255,255,255,0.15)',
          border: 'none',
          padding: 'var(--space-xs) var(--space-md)',
          color: 'var(--background)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.8125rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          borderRadius: '2px'
        }}
      >
        <span style={{ 
          width: '24px', 
          height: '24px', 
          background: 'var(--accent-gold)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--foreground)',
          fontWeight: 700,
          fontSize: '0.75rem'
        }}>
          {email.charAt(0).toUpperCase()}
        </span>
        <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {email.split('@')[0]}
        </span>
        <span style={{ fontSize: '0.625rem' }}>▼</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          right: 0,
          background: 'var(--background)',
          border: '1px solid var(--border-medium)',
          minWidth: '180px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 100
        }}>
          <div style={{ 
            padding: 'var(--space-md)',
            borderBottom: '1px solid var(--border-light)',
            fontSize: '0.75rem',
            color: 'var(--foreground-muted)'
          }}>
            {email}
          </div>
          <button
            onClick={handleSignOut}
            style={{
              width: '100%',
              padding: 'var(--space-md)',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.875rem',
              color: 'var(--foreground)'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-sunken)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
