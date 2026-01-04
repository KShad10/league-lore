'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface SleeperUser {
  user_id: string
  username: string
  display_name: string
  avatar: string | null
}

interface SleeperLeague {
  league_id: string
  name: string
  season: string
  status: string
  total_rosters: number
  avatar: string | null
  previous_league_id: string | null
}

type Step = 'username' | 'select-league' | 'syncing' | 'complete'

export default function OnboardingPage() {
  const router = useRouter()
  
  const [step, setStep] = useState<Step>('username')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [user, setUser] = useState<SleeperUser | null>(null)
  const [leagues, setLeagues] = useState<SleeperLeague[]>([])
  const [selectedLeague, setSelectedLeague] = useState<SleeperLeague | null>(null)
  const [syncProgress, setSyncProgress] = useState('')

  const handleFetchLeagues = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!username.trim()) {
      setError('Please enter your Sleeper username')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Try current season first, then previous if needed
      const currentYear = new Date().getFullYear()
      let response = await fetch(`/api/sleeper/user?username=${encodeURIComponent(username.trim())}&season=${currentYear}`)
      let data = await response.json()

      // If no leagues in current season, try previous season
      if (data.success && data.leagues.length === 0) {
        response = await fetch(`/api/sleeper/user?username=${encodeURIComponent(username.trim())}&season=${currentYear - 1}`)
        data = await response.json()
      }

      if (!data.success) {
        setError(data.error || 'Failed to find user')
        setLoading(false)
        return
      }

      if (data.leagues.length === 0) {
        setError('No fantasy football leagues found for this user')
        setLoading(false)
        return
      }

      setUser(data.user)
      setLeagues(data.leagues)
      setStep('select-league')
    } catch (err) {
      setError('Failed to connect to Sleeper. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectLeague = (league: SleeperLeague) => {
    setSelectedLeague(league)
  }

  const handleConnectLeague = async () => {
    if (!selectedLeague) return

    setStep('syncing')
    setSyncProgress('Connecting to Sleeper...')
    setError(null)

    try {
      setSyncProgress('Fetching league history...')
      
      const response = await fetch('/api/leagues/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sleeper_league_id: selectedLeague.league_id,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Failed to sync league')
        setStep('select-league')
        return
      }

      setSyncProgress('League connected successfully!')
      setStep('complete')
      
      // Redirect to dashboard after short delay
      setTimeout(() => {
        router.push('/dashboard/stats')
      }, 2000)

    } catch (err) {
      setError('Sync failed. Please try again.')
      setStep('select-league')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <nav style={{ 
        padding: 'var(--space-md) var(--space-xl)',
        borderBottom: '2px solid var(--border-light)'
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ 
            fontFamily: 'var(--font-serif)', 
            fontSize: '1.5rem', 
            fontWeight: 700, 
            color: 'var(--accent-primary)',
            letterSpacing: '0.05em'
          }}>
            LEAGUE LORE
          </span>
        </Link>
      </nav>

      <main className="page-container" style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center',
        maxWidth: '600px'
      }}>
        {/* Progress indicator */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-2xl)'
        }}>
          {['username', 'select-league', 'syncing'].map((s, i) => (
            <div 
              key={s}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: step === s || 
                  (step === 'complete' && i <= 2) ||
                  (step === 'syncing' && i <= 1) ||
                  (step === 'select-league' && i === 0)
                  ? 'var(--accent-primary)' 
                  : 'var(--border-light)',
                transition: 'background 0.3s ease'
              }}
            />
          ))}
        </div>

        {/* Step 1: Enter Username */}
        {step === 'username' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Connect Your Sleeper Account</h2>
            </div>
            
            <p className="text-muted" style={{ marginBottom: 'var(--space-lg)' }}>
              Enter your Sleeper username to find your fantasy football leagues.
            </p>

            {error && (
              <div className="info-banner error" style={{ marginBottom: 'var(--space-lg)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleFetchLeagues}>
              <div className="form-field">
                <label htmlFor="username">Sleeper Username</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 'var(--space-md)' }}
                disabled={loading}
              >
                {loading ? 'Searching...' : 'Find My Leagues'}
              </button>
            </form>

            <p className="text-muted text-xs" style={{ marginTop: 'var(--space-lg)', textAlign: 'center' }}>
              This is the username you use to log into Sleeper, not your display name.
            </p>
          </div>
        )}

        {/* Step 2: Select League */}
        {step === 'select-league' && (
          <div>
            <div style={{ marginBottom: 'var(--space-xl)' }}>
              <button 
                onClick={() => setStep('username')}
                className="btn btn-ghost"
                style={{ padding: 0, marginBottom: 'var(--space-md)' }}
              >
                ← Back
              </button>
              
              {user && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  {user.avatar && (
                    <img 
                      src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                      alt={user.display_name}
                      style={{ width: 48, height: 48, borderRadius: '50%' }}
                    />
                  )}
                  <div>
                    <p style={{ fontWeight: 600, margin: 0 }}>{user.display_name}</p>
                    <p className="text-muted text-sm" style={{ margin: 0 }}>@{user.username}</p>
                  </div>
                </div>
              )}
            </div>

            <h2 style={{ marginBottom: 'var(--space-lg)' }}>Select a League</h2>

            {error && (
              <div className="info-banner error" style={{ marginBottom: 'var(--space-lg)' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {leagues.map((league) => (
                <div
                  key={league.league_id}
                  onClick={() => handleSelectLeague(league)}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    border: selectedLeague?.league_id === league.league_id 
                      ? '2px solid var(--accent-primary)' 
                      : '1px solid var(--border-light)',
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    {league.avatar ? (
                      <img 
                        src={`https://sleepercdn.com/avatars/thumbs/${league.avatar}`}
                        alt={league.name}
                        style={{ width: 40, height: 40, borderRadius: '4px' }}
                      />
                    ) : (
                      <div style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: '4px',
                        background: 'var(--accent-primary)',
                        color: 'var(--background)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700
                      }}>
                        {league.name.charAt(0)}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, margin: 0 }}>{league.name}</p>
                      <p className="text-muted text-sm" style={{ margin: 0 }}>
                        {league.total_rosters} teams • {league.season} season
                      </p>
                    </div>
                    {selectedLeague?.league_id === league.league_id && (
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>✓</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleConnectLeague}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 'var(--space-xl)' }}
              disabled={!selectedLeague}
            >
              Connect League
            </button>
          </div>
        )}

        {/* Step 3: Syncing */}
        {step === 'syncing' && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="loading-spinner" style={{ margin: '0 auto var(--space-lg)' }}></div>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>Syncing League Data</h2>
            <p className="text-muted">{syncProgress}</p>
            <p className="text-muted text-sm" style={{ marginTop: 'var(--space-md)' }}>
              This may take a minute for leagues with multiple seasons...
            </p>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '3rem', 
              marginBottom: 'var(--space-md)',
              color: 'var(--win)'
            }}>
              ✓
            </div>
            <h2 style={{ marginBottom: 'var(--space-md)', color: 'var(--accent-primary)' }}>
              League Connected!
            </h2>
            <p className="text-muted" style={{ marginBottom: 'var(--space-lg)' }}>
              {selectedLeague?.name} has been synced successfully.
            </p>
            <p className="text-muted text-sm">Redirecting to dashboard...</p>
          </div>
        )}
      </main>
    </div>
  )
}
