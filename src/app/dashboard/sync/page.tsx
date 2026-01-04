'use client';

import { useState } from 'react';
import {
  PageHeader,
  Button,
  InfoBanner,
  LoadingIndicator,
  Card,
} from '@/components/ui';

export default function SyncPage() {
  const [leagueId, setLeagueId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  const handleSync = async () => {
    if (!leagueId.trim()) {
      setResult({ success: false, error: 'Please enter a Sleeper League ID' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/leagues/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sleeper_league_id: leagueId.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: `Successfully synced league: ${data.league?.name || leagueId}`,
        });
      } else {
        setResult({
          success: false,
          error: data.error || 'Failed to sync league',
        });
      }
    } catch (err) {
      setResult({
        success: false,
        error: `Sync failed: ${err}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container content-constrained">
      <PageHeader title="League Sync" subtitle="Connect to Sleeper" />

      <Card title="Sync League Data">
        <p className="text-muted mb-4">
          Enter your Sleeper League ID to sync all league history, managers, matchups, and
          statistics to the database.
        </p>

        <div className="control-field mb-4">
          <label className="control-label">Sleeper League ID</label>
          <input
            type="text"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            placeholder="e.g., 31da3d9c-39b9-4acf-991c-0accdbdffb64"
            className="control-input"
            style={{ width: '100%' }}
          />
        </div>

        <Button onClick={handleSync} disabled={loading || !leagueId.trim()}>
          {loading ? 'Syncing...' : 'Sync League'}
        </Button>
      </Card>

      {loading && (
        <div style={{ marginTop: 'var(--space-xl)' }}>
          <LoadingIndicator message="Syncing league data from Sleeper..." />
          <p className="text-muted text-sm text-center mt-2">
            This may take a minute for leagues with multiple seasons.
          </p>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 'var(--space-xl)' }}>
          {result.success ? (
            <InfoBanner>{result.message}</InfoBanner>
          ) : (
            <InfoBanner variant="error">{result.error}</InfoBanner>
          )}
        </div>
      )}

      <Card title="How to Find Your League ID" className="mt-6">
        <ol
          className="text-sm text-muted"
          style={{
            paddingLeft: 'var(--space-lg)',
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-sm)',
          }}
        >
          <li>Open the Sleeper app or go to sleeper.app</li>
          <li>Navigate to your fantasy football league</li>
          <li>Go to League Settings</li>
          <li>Copy the League ID (it&apos;s a UUID like the example above)</li>
        </ol>
      </Card>
    </div>
  );
}
