'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode } from 'react'
import { UserMenu } from '@/components/ui/UserMenu'
import { LeagueProvider, useLeague } from '@/lib/context/LeagueContext'

const NAV_ITEMS = [
  { href: '/dashboard/stats', label: 'Stats' },
  { href: '/dashboard/managers', label: 'Managers' },
  { href: '/dashboard/reports', label: 'Reports' },
  { href: '/dashboard/sync', label: 'Sync', deemphasized: true },
]

function DashboardNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { currentLeague, leagues, setCurrentLeague, loading } = useLeague()

  return (
    <nav className="dashboard-nav">
      <div className="nav-left">
        <Link href="/" className="nav-brand">
          League Lore
        </Link>

        <div className="nav-links">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? 'active' : ''} ${item.deemphasized ? 'deemphasized' : ''}`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="nav-right">
        {/* League Selector */}
        {!loading && leagues.length > 1 && (
          <select
            value={currentLeague?.id || ''}
            onChange={(e) => {
              const league = leagues.find(l => l.id === e.target.value)
              if (league) setCurrentLeague(league)
            }}
            className="league-selector"
          >
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        )}
        
        <UserMenu />
      </div>
    </nav>
  )
}

function LeagueHeader() {
  const { currentLeague, loading } = useLeague()
  
  if (loading) {
    return (
      <div className="league-header">
        <div className="league-header-content">
          <span className="league-name-loading">Loading...</span>
        </div>
      </div>
    )
  }
  
  if (!currentLeague) {
    return null
  }

  return (
    <div className="league-header">
      <div className="league-header-content">
        <h1 className="league-name">{currentLeague.name}</h1>
        <p className="league-meta">
          {currentLeague.team_count} teams • Est. {currentLeague.first_season}
        </p>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <LeagueProvider>
      <div className="dashboard-container">
        <DashboardNav />
        <LeagueHeader />
        <main className="dashboard-main">{children}</main>
      </div>
      
      <style jsx global>{`
        .dashboard-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        .dashboard-nav {
          background: var(--accent-primary);
          padding: var(--space-sm) var(--space-xl);
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 3px solid var(--accent-secondary);
        }
        
        .nav-left {
          display: flex;
          align-items: center;
          gap: var(--space-xl);
        }
        
        .nav-brand {
          color: var(--background);
          text-decoration: none;
          font-family: var(--font-serif);
          font-weight: 700;
          font-size: 1.25rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        
        .nav-links {
          display: flex;
          gap: var(--space-xs);
        }
        
        .nav-link {
          color: var(--background);
          text-decoration: none;
          font-family: var(--font-sans);
          font-size: 0.875rem;
          font-weight: 500;
          padding: var(--space-sm) var(--space-md);
          border-radius: 4px;
          transition: all 0.15s ease;
        }
        
        .nav-link:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .nav-link.active {
          color: var(--accent-gold);
          font-weight: 700;
        }
        
        .nav-link.deemphasized {
          font-size: 0.8125rem;
          opacity: 0.75;
        }
        
        .nav-link.deemphasized.active {
          opacity: 1;
        }
        
        .nav-right {
          display: flex;
          align-items: center;
          gap: var(--space-md);
        }
        
        .league-selector {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: var(--background);
          padding: var(--space-xs) var(--space-sm);
          border-radius: 4px;
          font-size: 0.8125rem;
          cursor: pointer;
        }
        
        .league-selector option {
          background: var(--accent-primary);
          color: var(--background);
        }
        
        .league-header {
          background: var(--surface);
          border-bottom: 2px solid var(--accent-primary);
          padding: var(--space-lg) var(--space-xl);
          text-align: center;
        }
        
        .league-header-content {
          max-width: 800px;
          margin: 0 auto;
        }
        
        .league-name {
          font-family: var(--font-serif);
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--accent-primary);
          margin: 0 0 var(--space-xs);
          letter-spacing: 0.02em;
        }
        
        .league-name-loading {
          font-family: var(--font-serif);
          font-size: 1.25rem;
          color: var(--text-muted);
        }
        
        .league-meta {
          font-family: var(--font-sans);
          font-size: 0.875rem;
          color: var(--text-muted);
          margin: 0;
        }
        
        .dashboard-main {
          flex: 1;
        }
      `}</style>
    </LeagueProvider>
  )
}
