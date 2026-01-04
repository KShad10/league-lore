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
      
      setTimeout(() => {
        router.push('/dashboard/stats')
      }, 2000)

    } catch (err) {
      setError('Sync failed. Please try again.')
      setStep('select-league')
    }
  }

  const stepNumber = step === 'username' ? 1 : step === 'select-league' ? 2 : 3

  return (
    <div className="onboarding-container">
      {/* Header */}
      <header className="onboarding-header">
        <Link href="/" className="onboarding-brand">
          League Lore
        </Link>
      </header>

      <main className="onboarding-main">
        {/* Progress Steps */}
        <div className="onboarding-progress">
          <div className={`progress-step ${stepNumber >= 1 ? 'active' : ''} ${stepNumber > 1 ? 'completed' : ''}`}>
            <div className="step-number">1</div>
            <span className="step-label">Find Account</span>
          </div>
          <div className="progress-line" />
          <div className={`progress-step ${stepNumber >= 2 ? 'active' : ''} ${stepNumber > 2 ? 'completed' : ''}`}>
            <div className="step-number">2</div>
            <span className="step-label">Select League</span>
          </div>
          <div className="progress-line" />
          <div className={`progress-step ${stepNumber >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <span className="step-label">Sync Data</span>
          </div>
        </div>

        {/* Step 1: Enter Username */}
        {step === 'username' && (
          <div className="onboarding-card">
            <div className="card-icon">🏈</div>
            <h1 className="card-title">Connect Your Sleeper Account</h1>
            <p className="card-description">
              Enter your Sleeper username to find your fantasy football leagues and start generating reports.
            </p>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <form onSubmit={handleFetchLeagues} className="onboarding-form">
              <div className="form-group">
                <label htmlFor="username">Sleeper Username</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g., YourSleeperName"
                  autoComplete="off"
                  autoFocus
                />
                <span className="form-hint">
                  This is the username you use to log into Sleeper
                </span>
              </div>

              <button 
                type="submit" 
                className="btn-primary"
                disabled={loading || !username.trim()}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Searching...
                  </>
                ) : (
                  'Find My Leagues'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Select League */}
        {step === 'select-league' && (
          <div className="onboarding-card wide">
            <button 
              onClick={() => {
                setStep('username')
                setError(null)
              }}
              className="back-button"
            >
              ← Back
            </button>
            
            {user && (
              <div className="user-info">
                {user.avatar ? (
                  <img 
                    src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                    alt={user.display_name}
                    className="user-avatar"
                  />
                ) : (
                  <div className="user-avatar-placeholder">
                    {user.display_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="user-name">{user.display_name}</p>
                  <p className="user-handle">@{user.username}</p>
                </div>
              </div>
            )}

            <h1 className="card-title">Select Your League</h1>
            <p className="card-description">
              Choose which league you want to create reports for. You can add more leagues later.
            </p>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="leagues-list">
              {leagues.map((league) => (
                <div
                  key={league.league_id}
                  onClick={() => handleSelectLeague(league)}
                  className={`league-card ${selectedLeague?.league_id === league.league_id ? 'selected' : ''}`}
                >
                  <div className="league-card-content">
                    {league.avatar ? (
                      <img 
                        src={`https://sleepercdn.com/avatars/thumbs/${league.avatar}`}
                        alt={league.name}
                        className="league-avatar"
                      />
                    ) : (
                      <div className="league-avatar-placeholder">
                        {league.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="league-info">
                      <p className="league-name">{league.name}</p>
                      <p className="league-meta">
                        {league.total_rosters} teams • {league.season} season
                      </p>
                    </div>
                  </div>
                  {selectedLeague?.league_id === league.league_id && (
                    <div className="selected-check">✓</div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleConnectLeague}
              className="btn-primary"
              disabled={!selectedLeague}
            >
              Connect League
            </button>
          </div>
        )}

        {/* Step 3: Syncing */}
        {step === 'syncing' && (
          <div className="onboarding-card">
            <div className="sync-spinner" />
            <h1 className="card-title">Syncing League Data</h1>
            <p className="card-description">{syncProgress}</p>
            <p className="sync-note">
              This may take a minute for leagues with multiple seasons of history...
            </p>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <div className="onboarding-card">
            <div className="success-icon">✓</div>
            <h1 className="card-title success">League Connected!</h1>
            <p className="card-description">
              <strong>{selectedLeague?.name}</strong> has been synced successfully.
            </p>
            <p className="sync-note">Redirecting to your dashboard...</p>
          </div>
        )}
      </main>

      <style jsx>{`
        .onboarding-container {
          min-height: 100vh;
          background: var(--background);
          display: flex;
          flex-direction: column;
        }

        .onboarding-header {
          padding: var(--space-md) var(--space-xl);
          border-bottom: 2px solid var(--border-light);
        }

        .onboarding-brand {
          font-family: var(--font-serif);
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--accent-primary);
          text-decoration: none;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .onboarding-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--space-2xl) var(--space-lg);
          max-width: 640px;
          margin: 0 auto;
          width: 100%;
        }

        /* Progress Steps */
        .onboarding-progress {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          margin-bottom: var(--space-2xl);
          width: 100%;
          max-width: 400px;
        }

        .progress-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-xs);
        }

        .step-number {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.875rem;
          background: var(--surface);
          border: 2px solid var(--border-light);
          color: var(--text-muted);
          transition: all 0.2s ease;
        }

        .progress-step.active .step-number {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: white;
        }

        .progress-step.completed .step-number {
          background: var(--win);
          border-color: var(--win);
          color: white;
        }

        .step-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-align: center;
          white-space: nowrap;
        }

        .progress-step.active .step-label {
          color: var(--foreground);
          font-weight: 500;
        }

        .progress-line {
          flex: 1;
          height: 2px;
          background: var(--border-light);
          margin-bottom: 20px;
        }

        /* Card */
        .onboarding-card {
          background: var(--surface);
          border: 1px solid var(--border-light);
          border-radius: 8px;
          padding: var(--space-2xl);
          width: 100%;
          text-align: center;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .onboarding-card.wide {
          max-width: 560px;
        }

        .card-icon {
          font-size: 3rem;
          margin-bottom: var(--space-md);
        }

        .card-title {
          font-family: var(--font-serif);
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--accent-primary);
          margin: 0 0 var(--space-sm);
        }

        .card-title.success {
          color: var(--win);
        }

        .card-description {
          font-size: 0.9375rem;
          color: var(--text-muted);
          margin: 0 0 var(--space-lg);
          line-height: 1.6;
        }

        /* Error Message */
        .error-message {
          background: rgba(139, 69, 19, 0.1);
          border-left: 3px solid var(--loss);
          color: var(--loss);
          padding: var(--space-sm) var(--space-md);
          margin-bottom: var(--space-lg);
          text-align: left;
          font-size: 0.875rem;
        }

        /* Form */
        .onboarding-form {
          text-align: left;
        }

        .form-group {
          margin-bottom: var(--space-lg);
        }

        .form-group label {
          display: block;
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--foreground);
          margin-bottom: var(--space-xs);
        }

        .form-group input {
          width: 100%;
          padding: var(--space-md);
          font-size: 1rem;
          border: 2px solid var(--border-light);
          border-radius: 4px;
          background: var(--background);
          color: var(--foreground);
          transition: border-color 0.15s ease;
        }

        .form-group input:focus {
          outline: none;
          border-color: var(--accent-primary);
        }

        .form-group input::placeholder {
          color: var(--text-muted);
        }

        .form-hint {
          display: block;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: var(--space-xs);
        }

        /* Buttons */
        .btn-primary {
          width: 100%;
          padding: var(--space-md) var(--space-lg);
          font-size: 1rem;
          font-weight: 600;
          color: white;
          background: var(--accent-primary);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-sm);
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--accent-secondary);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .back-button {
          background: none;
          border: none;
          color: var(--accent-primary);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          padding: 0;
          margin-bottom: var(--space-lg);
          display: block;
          text-align: left;
        }

        .back-button:hover {
          text-decoration: underline;
        }

        /* User Info */
        .user-info {
          display: flex;
          align-items: center;
          gap: var(--space-md);
          padding: var(--space-md);
          background: var(--surface-sunken);
          border-radius: 8px;
          margin-bottom: var(--space-lg);
        }

        .user-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
        }

        .user-avatar-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--accent-primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.25rem;
        }

        .user-name {
          font-weight: 600;
          margin: 0;
          color: var(--foreground);
        }

        .user-handle {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin: 0;
        }

        /* League Cards */
        .leagues-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
          margin-bottom: var(--space-lg);
          text-align: left;
        }

        .league-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-md);
          background: var(--background);
          border: 2px solid var(--border-light);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .league-card:hover {
          border-color: var(--accent-primary);
        }

        .league-card.selected {
          border-color: var(--accent-primary);
          background: rgba(37, 68, 50, 0.05);
        }

        .league-card-content {
          display: flex;
          align-items: center;
          gap: var(--space-md);
        }

        .league-avatar {
          width: 40px;
          height: 40px;
          border-radius: 4px;
        }

        .league-avatar-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          background: var(--accent-primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        .league-info {
          display: flex;
          flex-direction: column;
        }

        .league-name {
          font-weight: 600;
          margin: 0;
          color: var(--foreground);
        }

        .league-meta {
          font-size: 0.8125rem;
          color: var(--text-muted);
          margin: 0;
        }

        .selected-check {
          color: var(--accent-primary);
          font-weight: 700;
          font-size: 1.25rem;
        }

        /* Syncing */
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .sync-spinner {
          width: 48px;
          height: 48px;
          border: 3px solid var(--border-light);
          border-top-color: var(--accent-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto var(--space-lg);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .sync-note {
          font-size: 0.8125rem;
          color: var(--text-muted);
          margin: var(--space-md) 0 0;
        }

        /* Success */
        .success-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--win);
          color: white;
          font-size: 2rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto var(--space-lg);
        }
      `}</style>
    </div>
  )
}
