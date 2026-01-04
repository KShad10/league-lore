'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useState } from 'react'
import { UserMenu } from '@/components/ui/UserMenu'
import { LeagueProvider, useLeague } from '@/lib/context/LeagueContext'

const NAV_ITEMS = [
  { href: '/dashboard/stats', label: 'Stats', icon: '📊' },
  { href: '/dashboard/managers', label: 'Managers', icon: '👥' },
  { href: '/dashboard/reports', label: 'Reports', icon: '📄' },
  { href: '/dashboard/sync', label: 'Sync', icon: '🔄', deemphasized: true },
]

function DashboardNav() {
  const pathname = usePathname()
  const { currentLeague, leagues, setCurrentLeague, loading } = useLeague()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      <nav className="dashboard-nav">
        <div className="nav-left">
          <Link href="/" className="nav-brand">
            <span className="brand-full">League Lore</span>
            <span className="brand-short">LL</span>
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
          
          <button 
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <>
          <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} />
          <div className="mobile-menu">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="mobile-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="mobile-bottom-nav">
        {NAV_ITEMS.filter(item => !item.deemphasized).map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="bottom-nav-icon">{item.icon}</span>
              <span className="bottom-nav-label">{item.label}</span>
            </Link>
          )
        })}
      </nav>
      
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
          position: relative;
          z-index: 100;
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
        
        .brand-short {
          display: none;
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
        
        .mobile-menu-btn {
          display: none;
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          font-size: 1.25rem;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .mobile-menu-backdrop {
          display: none;
        }
        
        .mobile-menu {
          display: none;
        }
        
        .mobile-bottom-nav {
          display: none;
        }
        
        .league-header {
          background: var(--surface);
          border-bottom: 2px solid var(--border-light);
          padding: var(--space-lg) var(--space-xl);
          text-align: center;
        }
        
        .league-header-content {
          max-width: 800px;
          margin: 0 auto;
        }
        
        .league-name {
          font-family: var(--font-serif);
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--accent-primary);
          margin: 0 0 var(--space-xs);
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        
        .league-name-loading {
          font-family: var(--font-serif);
          font-size: 1.25rem;
          color: var(--text-muted);
        }
        
        .league-meta {
          font-family: var(--font-sans);
          font-size: 0.8125rem;
          color: var(--text-muted);
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .dashboard-main {
          flex: 1;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           TABLET BREAKPOINT
           ═══════════════════════════════════════════════════════════════ */
        @media (max-width: 900px) {
          .dashboard-nav {
            padding: var(--space-sm) var(--space-md);
          }
          
          .nav-left {
            gap: var(--space-md);
          }
          
          .nav-link {
            padding: var(--space-xs) var(--space-sm);
            font-size: 0.8125rem;
          }
          
          .league-header {
            padding: var(--space-md) var(--space-md);
          }
          
          .league-name {
            font-size: 1.25rem;
          }
        }
        
        /* ═══════════════════════════════════════════════════════════════
           MOBILE BREAKPOINT
           ═══════════════════════════════════════════════════════════════ */
        @media (max-width: 640px) {
          .dashboard-container {
            padding-bottom: 60px;
          }
          
          .dashboard-nav {
            padding: 10px 12px;
          }
          
          .nav-left {
            gap: var(--space-sm);
          }
          
          .brand-full {
            display: none;
          }
          
          .brand-short {
            display: inline;
          }
          
          .nav-links {
            display: none;
          }
          
          .nav-right {
            gap: var(--space-sm);
          }
          
          .league-selector {
            max-width: 120px;
            font-size: 0.75rem;
            padding: 6px 8px;
          }
          
          .mobile-menu-btn {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .mobile-menu-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 150;
          }
          
          .mobile-menu {
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 56px;
            right: 0;
            width: 200px;
            background: var(--surface);
            border-left: 1px solid var(--border-light);
            box-shadow: -4px 0 20px rgba(0,0,0,0.15);
            z-index: 200;
            padding: 8px 0;
          }
          
          .mobile-nav-link {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            font-size: 0.9375rem;
            color: var(--foreground);
            text-decoration: none;
            transition: background 0.15s;
          }
          
          .mobile-nav-link:hover,
          .mobile-nav-link.active {
            background: var(--surface-sunken);
          }
          
          .mobile-nav-link.active {
            color: var(--accent-primary);
            font-weight: 600;
          }
          
          .mobile-nav-icon {
            font-size: 1.25rem;
          }
          
          /* Bottom Navigation */
          .mobile-bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--surface);
            border-top: 1px solid var(--border-light);
            z-index: 100;
            padding: 6px 0;
            padding-bottom: max(6px, env(safe-area-inset-bottom));
          }
          
          .bottom-nav-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            padding: 6px 4px;
            color: var(--text-muted);
            text-decoration: none;
            font-size: 0.625rem;
            font-weight: 500;
            transition: color 0.15s;
          }
          
          .bottom-nav-item.active {
            color: var(--accent-primary);
          }
          
          .bottom-nav-icon {
            font-size: 1.25rem;
          }
          
          .bottom-nav-label {
            text-transform: uppercase;
            letter-spacing: 0.03em;
          }
          
          /* League Header Mobile */
          .league-header {
            padding: var(--space-md) var(--space-sm);
          }
          
          .league-name {
            font-size: 1rem;
            letter-spacing: 0.01em;
          }
          
          .league-meta {
            font-size: 0.6875rem;
          }
        }
        
        /* ═══════════════════════════════════════════════════════════════
           SMALL MOBILE
           ═══════════════════════════════════════════════════════════════ */
        @media (max-width: 380px) {
          .league-selector {
            max-width: 100px;
          }
          
          .league-name {
            font-size: 0.9375rem;
          }
        }
      `}</style>
    </>
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

  const cleanName = currentLeague.name.replace(/,?\s*(EST\.?\s*\d{4})/i, '').trim()
  
  const seasonRange = currentLeague.first_season === currentLeague.current_season
    ? `${currentLeague.first_season} Season`
    : `${currentLeague.first_season}–${currentLeague.current_season}`

  return (
    <div className="league-header">
      <div className="league-header-content">
        <h1 className="league-name">{cleanName}</h1>
        <p className="league-meta">
          {currentLeague.team_count} Teams • {seasonRange}
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
    </LeagueProvider>
  )
}
