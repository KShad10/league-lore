import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="page-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <header className="page-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <h1 className="page-title" style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>
          League Lore
        </h1>
        <p className="page-subtitle" style={{ fontSize: '1rem' }}>
          Fantasy Football Almanac & Report Generator
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-xl)',
          maxWidth: '900px',
          margin: 'var(--space-2xl) auto 0',
          width: '100%',
        }}
      >
        <Link href="/dashboard/stats" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}>
            <div className="card-header">
              <h3 className="card-title">League Stats</h3>
            </div>
            <p className="text-muted text-sm">
              View standings, head-to-head records, matchup history, streaks, and career statistics.
            </p>
          </div>
        </Link>

        <Link href="/dashboard/reports" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}>
            <div className="card-header">
              <h3 className="card-title">Report Generator</h3>
            </div>
            <p className="text-muted text-sm">
              Generate weekly recaps and postseason reports with AI-powered commentary.
            </p>
          </div>
        </Link>

        <Link href="/dashboard/sync" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}>
            <div className="card-header">
              <h3 className="card-title">League Sync</h3>
            </div>
            <p className="text-muted text-sm">
              Connect to Sleeper and sync your league data including all seasons and rosters.
            </p>
          </div>
        </Link>
      </div>

      <footer
        style={{
          marginTop: 'auto',
          paddingTop: 'var(--space-3xl)',
          textAlign: 'center',
        }}
      >
        <p className="text-muted text-xs">
          OG Papio Dynasty League • Est. 2022
        </p>
      </footer>
    </div>
  );
}
