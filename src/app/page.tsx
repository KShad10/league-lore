import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation */}
      <nav style={{ 
        padding: 'var(--space-md) var(--space-xl)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
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
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
          {user ? (
            <Link href="/dashboard">
              <button className="btn btn-primary">Dashboard</button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <button className="btn btn-ghost">Sign In</button>
              </Link>
              <Link href="/signup">
                <button className="btn btn-primary">Get Started</button>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="page-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <section style={{ textAlign: 'center', padding: 'var(--space-3xl) 0' }}>
          <h1 style={{ 
            fontSize: 'clamp(2.5rem, 6vw, 4rem)', 
            marginBottom: 'var(--space-lg)',
            color: 'var(--accent-primary)',
            letterSpacing: '0.08em',
            lineHeight: 1.1
          }}>
            LEAGUE LORE
          </h1>
          <p style={{ 
            fontSize: '1.25rem', 
            color: 'var(--accent-secondary)',
            fontWeight: 600,
            letterSpacing: '0.03em',
            marginBottom: 'var(--space-xl)'
          }}>
            Fantasy Football Almanac & Report Generator
          </p>
          <p className="text-muted" style={{ 
            maxWidth: '600px', 
            margin: '0 auto var(--space-2xl)',
            fontSize: '1.125rem',
            lineHeight: 1.7
          }}>
            Transform your league&apos;s raw data into professional weekly reports 
            with AI-powered commentary. Track rivalries, preserve history, 
            and give your league the coverage it deserves.
          </p>
          
          {!user && (
            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/signup">
                <button className="btn btn-primary" style={{ padding: 'var(--space-md) var(--space-xl)' }}>
                  Start Free
                </button>
              </Link>
              <a href="#features">
                <button className="btn btn-secondary" style={{ padding: 'var(--space-md) var(--space-xl)' }}>
                  See Features
                </button>
              </a>
            </div>
          )}
        </section>

        {/* Features Grid */}
        <section id="features" style={{ padding: 'var(--space-3xl) 0' }}>
          <h2 style={{ 
            textAlign: 'center', 
            marginBottom: 'var(--space-2xl)',
            fontSize: '1.5rem',
            letterSpacing: '0.05em'
          }}>
            EVERYTHING YOUR LEAGUE NEEDS
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-xl)',
            maxWidth: '1000px',
            margin: '0 auto'
          }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">League Stats</h3>
              </div>
              <p className="text-muted text-sm">
                Standings, head-to-head records, matchup history, winning streaks, 
                and comprehensive career statistics across all seasons.
              </p>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">AI Reports</h3>
              </div>
              <p className="text-muted text-sm">
                Generate weekly recaps with customizable voice presets—from brutal roasts 
                to professional analysis. Export as polished PDFs.
              </p>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Sleeper Sync</h3>
              </div>
              <p className="text-muted text-sm">
                Connect your Sleeper league and sync all historical data automatically. 
                Rosters, matchups, and transactions preserved forever.
              </p>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Manager Profiles</h3>
              </div>
              <p className="text-muted text-sm">
                Configure rivalries, nicknames, and context for each manager. 
                AI commentary becomes personal and league-aware.
              </p>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Dynasty Values</h3>
              </div>
              <p className="text-muted text-sm">
                Track roster values over time with integrated dynasty rankings. 
                See which teams are building for the future.
              </p>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Historical Records</h3>
              </div>
              <p className="text-muted text-sm">
                All-time leaderboards, single-week records, playoff brackets, 
                and the full story of your league preserved in one place.
              </p>
            </div>
          </div>
        </section>

        {/* Voice Presets Preview */}
        <section style={{ padding: 'var(--space-3xl) 0' }}>
          <div style={{ 
            maxWidth: '800px', 
            margin: '0 auto',
            textAlign: 'center'
          }}>
            <h2 style={{ 
              marginBottom: 'var(--space-xl)',
              fontSize: '1.5rem',
              letterSpacing: '0.05em'
            }}>
              YOUR VOICE, YOUR STYLE
            </h2>
            <p className="text-muted" style={{ marginBottom: 'var(--space-xl)', fontSize: '1rem' }}>
              Choose how your reports sound. From ruthless commentary to straight analysis.
            </p>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-md)'
            }}>
              {[
                { name: 'Supreme Leader', desc: 'Brutal roasts, maximum drama' },
                { name: 'Professional', desc: 'ESPN-style, data-driven' },
                { name: 'Casual Friend', desc: 'Light trash talk, encouraging' },
                { name: 'Custom', desc: 'Define your own voice' }
              ].map((voice) => (
                <div 
                  key={voice.name}
                  style={{ 
                    padding: 'var(--space-md)',
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--border-light)'
                  }}
                >
                  <p style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>{voice.name}</p>
                  <p className="text-muted text-xs">{voice.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        {!user && (
          <section style={{ 
            padding: 'var(--space-3xl) var(--space-xl)',
            background: 'var(--surface-sunken)',
            border: '1px solid var(--border-light)',
            textAlign: 'center',
            margin: 'var(--space-2xl) 0'
          }}>
            <h2 style={{ marginBottom: 'var(--space-md)', fontSize: '1.5rem' }}>
              GIVE YOUR LEAGUE THE COVERAGE IT DESERVES
            </h2>
            <p className="text-muted" style={{ marginBottom: 'var(--space-xl)', maxWidth: '500px', margin: '0 auto var(--space-xl)' }}>
              Start preserving your league&apos;s history today. Connect your Sleeper league 
              and generate your first report in minutes.
            </p>
            <Link href="/signup">
              <button className="btn btn-primary" style={{ padding: 'var(--space-md) var(--space-2xl)' }}>
                Create Free Account
              </button>
            </Link>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer style={{ 
        padding: 'var(--space-xl)',
        textAlign: 'center',
        borderTop: '1px solid var(--border-light)'
      }}>
        <p className="text-muted text-xs">
          League Lore • Built for commissioners who care about their league&apos;s story
        </p>
        <p className="text-muted text-xs" style={{ marginTop: 'var(--space-sm)' }}>
          © 2025 League Lore. Powered by Sleeper API.
        </p>
      </footer>
    </div>
  )
}
