'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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

interface ConnectedLeague {
  id: string
  name: string
  sleeper_league_id: string
  current_season: number
  last_sync_at: string
}

export default function SyncPage() {
  const router = useRouter()
  
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [user, setUser] = useState<SleeperUser | null>(null)
  const [leagues, setLeagues] = useState<SleeperLeague[]>([])
  const [connectedLeagues, setConnectedLeagues] = useState<ConnectedLeague[]>([])
  const [showLeagueSelector, setShowLeagueSelector] = useState(false)

  // Fetch user's connected leagues on mount
  useEffect(() => {
    fetchConnectedLeagues()
  }, [])

  const fetchConnectedLeagues = async () => {
    try {
      const response = await fetch('/api/leagues')
      const data = await response.json()
      if (data.success) {
        setConnectedLeagues(data.leagues)
      }
    } catch (err) {
      console.error('Failed to fetch connected leagues:', err)
    }
  }

  const handleFetchLeagues = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!username.trim()) {
      setError('Please enter your Sleeper username')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const currentYear = new Date().getFullYear()
      let response = await fetch(`/api/sleeper/user?username=${encodeURIComponent(username.trim())}&season=${currentYear}`)
      let data = await response.json()

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
      setShowLeagueSelector(true)
    } catch (err) {
      setError('Failed to connect to Sleeper. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSyncLeague = async (league: SleeperLeague) => {
    setSyncing(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/leagues/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sleeper_league_id: league.league_id,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Failed to sync league')
        setSyncing(false)
        return
      }

      setSuccess(`Successfully synced "${league.name}" - ${data.message}`)
      setShowLeagueSelector(false)
      setLeagues([])
      setUser(null)
      setUsername('')
      
      // Refresh connected leagues
      await fetchConnectedLeagues()

    } catch (err) {
      setError('Sync failed. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  const handleResync = async (league: ConnectedLeague) => {
    setSyncing(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/leagues/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sleeper_league_id: league.sleeper_league_id,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Failed to sync league')
        setSyncing(false)
        return
      }

      setSuccess(`Successfully re-synced "${league.name}"`)
      await fetchConnectedLeagues()

    } catch (err) {
      setError('Sync failed. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="page-container content-constrained">
      <header className="page-header">
        <h1 className="page-title">League Sync</h1>
        <p className="page-subtitle">Connect and sync your Sleeper leagues</p>
      </header>

      {/* Connected Leagues */}
      {connectedLeagues.length > 0 && (
        <section className="section-block">
          <div className="section-header">
            <h2 className="section-title">Connected Leagues</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {connectedLeagues.map((league) => (
              <div key={league.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 600, margin: 0 }}>{league.name}</p>
                    <p className="text-muted text-sm" style={{ margin: 0 }}>
                      {league.current_season} season • Last synced: {new Date(league.last_sync_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleResync(league)}
                    className="btn btn-secondary"
                    disabled={syncing}
                  >
                    {syncing ? 'Syncing...' : 'Re-sync'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Success/Error Messages */}
      {success && (
        <div className="info-banner" style={{ marginBottom: 'var(--space-lg)', borderLeftColor: 'var(--win)' }}>
          {success}
        </div>
      )}

      {error && (
        <div className="info-banner error" style={{ marginBottom: 'var(--space-lg)' }}>
          {error}
        </div>
      )}

      {/* Add New League */}
      <section className="section-block">
        <div className="section-header">
          <h2 className="section-title">Add a League</h2>
        </div>

        {!showLeagueSelector ? (
          <div className="card">
            <p className="text-muted" style={{ marginBottom: 'var(--space-lg)' }}>
              Enter your Sleeper username to find your fantasy football leagues.
            </p>

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
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Searching...' : 'Find My Leagues'}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <button 
                onClick={() => {
                  setShowLeagueSelector(false)
                  setLeagues([])
                  setUser(null)
                }}
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

            <h3 style={{ marginBottom: 'var(--space-md)' }}>Select a League to Sync</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {leagues.map((league) => {
                const isConnected = connectedLeagues.some(
                  cl => cl.sleeper_league_id === league.league_id
                )
                
                return (
                  <div key={league.league_id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                        <div>
                          <p style={{ fontWeight: 600, margin: 0 }}>{league.name}</p>
                          <p className="text-muted text-sm" style={{ margin: 0 }}>
                            {league.total_rosters} teams • {league.season} season
                          </p>
                        </div>
                      </div>
                      
                      {isConnected ? (
                        <span className="text-muted text-sm">Already connected</span>
                      ) : (
                        <button
                          onClick={() => handleSyncLeague(league)}
                          className="btn btn-primary"
                          disabled={syncing}
                        >
                          {syncing ? 'Syncing...' : 'Sync'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
