'use client';

import { useState, useEffect, useCallback, CSSProperties } from 'react';
import {
  PageHeader,
  SectionHeader,
  InfoBanner,
  LoadingIndicator,
  EmptyState,
} from '@/components/ui';

const LEAGUE_ID = '31da3d9c-39b9-4acf-991c-0accdbdffb64';

interface Manager {
  id: string;
  sleeperUserId: string;
  username: string;
  displayName: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  contextNotes: string | null;
  rivalryNotes: Record<string, string> | null;
  isActive: boolean;
  career: {
    totalWeeks: number;
    combined: { wins: number; losses: number; winPct: number; rank: number };
    points: { totalPF: number; avgPerWeek: number };
  };
  rank: number;
}

interface ManagerUpdates {
  display_name?: string;
  nickname?: string;
  context_notes?: string;
  rivalry_notes?: Record<string, string>;
}

// Inline styles
const styles: Record<string, CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1.5rem',
    marginTop: '2rem',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.6)',
    border: '2px solid #c8b299',
    padding: '1.5rem',
  },
  cardConfigured: {
    background: 'rgba(255, 255, 255, 0.6)',
    border: '2px solid #2d5016',
    padding: '1.5rem',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '1rem',
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    border: '2px solid #a89880',
  },
  avatarPlaceholder: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: '#2d5016',
    color: '#f5e6d3',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Georgia, serif',
    fontWeight: 700,
    fontSize: '1.25rem',
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: 'Georgia, serif',
    fontWeight: 700,
    fontSize: '1.125rem',
    color: '#2d3319',
    lineHeight: 1.3,
  },
  nickname: {
    display: 'block',
    fontFamily: 'system-ui, sans-serif',
    fontWeight: 400,
    fontSize: '0.875rem',
    color: '#8b6914',
    fontStyle: 'italic',
  },
  username: {
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.75rem',
    color: '#4a4a3a',
    marginTop: '2px',
  },
  rank: {
    fontFamily: 'Georgia, serif',
    fontWeight: 700,
    fontSize: '1rem',
    color: '#4a4a3a',
    background: 'rgba(45, 80, 22, 0.05)',
    padding: '0.25rem 0.5rem',
  },
  statsRow: {
    display: 'flex',
    gap: '1.5rem',
    padding: '1rem 0',
    borderTop: '1px solid #c8b299',
    borderBottom: '1px solid #c8b299',
    marginBottom: '1rem',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  statLabel: {
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.6875rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: '#4a4a3a',
  },
  statValue: {
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#2d3319',
  },
  contextSection: {
    marginBottom: '1rem',
  },
  contextLabel: {
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.6875rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: '#4a4a3a',
    marginBottom: '4px',
  },
  contextText: {
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.8125rem',
    color: '#2d3319',
    lineHeight: 1.5,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical' as const,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  configStatus: {
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.75rem',
  },
  statusConfigured: {
    color: '#3d6b22',
  },
  statusUnconfigured: {
    color: '#4a4a3a',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.5rem 1.5rem',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.875rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
    border: '2px solid #2d5016',
    background: 'transparent',
    color: '#2d5016',
    cursor: 'pointer',
  },
  // Modal styles
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1.5rem',
  },
  modal: {
    background: '#f5e6d3',
    border: '3px solid #c8553d',
    maxWidth: '640px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.5rem',
    borderBottom: '2px solid #c8b299',
    background: 'rgba(255, 255, 255, 0.6)',
  },
  modalTitle: {
    fontFamily: 'Georgia, serif',
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#2d3319',
    margin: 0,
  },
  modalClose: {
    background: 'none',
    border: 'none',
    fontSize: '1.75rem',
    color: '#4a4a3a',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },
  modalBody: {
    padding: '1.5rem',
    overflowY: 'scroll' as const,
    flex: '1 1 auto',
    minHeight: 0,
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    padding: '1.5rem',
    borderTop: '2px solid #c8b299',
    background: 'rgba(255, 255, 255, 0.6)',
  },
  formSection: {
    marginBottom: '2rem',
  },
  formSectionTitle: {
    fontFamily: 'Georgia, serif',
    fontSize: '1rem',
    fontWeight: 700,
    color: '#2d5016',
    margin: '0 0 1rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  formField: {
    marginBottom: '1rem',
  },
  formLabel: {
    display: 'block',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: '#2d3319',
    marginBottom: '0.25rem',
  },
  formInput: {
    width: '100%',
    padding: '0.5rem 1rem',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.875rem',
    color: '#2d3319',
    background: 'rgba(45, 80, 22, 0.05)',
    border: '1px solid #a89880',
    boxSizing: 'border-box' as const,
  },
  formTextarea: {
    width: '100%',
    padding: '0.5rem 1rem',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.875rem',
    color: '#2d3319',
    background: 'rgba(45, 80, 22, 0.05)',
    border: '1px solid #a89880',
    resize: 'vertical' as const,
    minHeight: '80px',
    boxSizing: 'border-box' as const,
  },
  formHint: {
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.75rem',
    color: '#4a4a3a',
    margin: '0.25rem 0 0',
  },
  sectionHint: {
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.8125rem',
    color: '#4a4a3a',
    margin: '0 0 1rem',
  },
  rivalryList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  rivalryField: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    gap: '1rem',
    alignItems: 'center',
  },
  rivalryLabel: {
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.8125rem',
    color: '#2d3319',
    textAlign: 'right' as const,
  },
  rivalryInput: {
    padding: '0.25rem 0.5rem',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.8125rem',
    color: '#2d3319',
    background: 'rgba(45, 80, 22, 0.05)',
    border: '1px solid #a89880',
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.5rem 1.5rem',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.875rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
    border: '2px solid #2d5016',
    background: '#2d5016',
    color: '#f5e6d3',
    cursor: 'pointer',
  },
  btnGhost: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.5rem 1.5rem',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.875rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
    border: '2px solid transparent',
    background: 'transparent',
    color: '#4a4a3a',
    cursor: 'pointer',
  },
};

export default function ManagersPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);

  const fetchManagers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/leagues/${LEAGUE_ID}/managers`);
      const result = await response.json();

      if (result.success) {
        setManagers(result.managers);
      } else {
        setError(result.error || 'Failed to fetch managers');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  const handleSave = async (managerId: string, updates: ManagerUpdates) => {
    try {
      const response = await fetch(`/api/leagues/${LEAGUE_ID}/managers/${managerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (result.success) {
        setManagers((prev) =>
          prev.map((m) =>
            m.id === managerId
              ? {
                  ...m,
                  displayName: result.manager.displayName,
                  nickname: result.manager.nickname,
                  contextNotes: result.manager.contextNotes,
                  rivalryNotes: result.manager.rivalryNotes,
                }
              : m
          )
        );
        setEditingManager(null);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      alert(`Failed to save: ${err}`);
    }
  };

  const handleEditClick = (manager: Manager) => {
    console.log('Edit clicked for:', manager.username);
    setEditingManager(manager);
  };

  if (loading) {
    return (
      <div className="page-container">
        <PageHeader title="Manager Configuration" subtitle="OG Papio Dynasty League" />
        <LoadingIndicator message="Loading managers..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <PageHeader title="Manager Configuration" subtitle="OG Papio Dynasty League" />
        <InfoBanner variant="error">{error}</InfoBanner>
      </div>
    );
  }

  if (managers.length === 0) {
    return (
      <div className="page-container">
        <PageHeader title="Manager Configuration" subtitle="OG Papio Dynasty League" />
        <EmptyState
          title="No managers found"
          description="Sync your league data first to populate managers."
        />
      </div>
    );
  }

  const configuredCount = managers.filter(
    (m) => m.displayName || m.nickname || m.contextNotes
  ).length;

  return (
    <div className="page-container">
      <PageHeader title="Manager Configuration" subtitle="OG Papio Dynasty League" />

      <SectionHeader
        title="Configure Managers"
        context={`${configuredCount}/${managers.length} configured`}
      />

      <InfoBanner>
        Configure display names, nicknames, and context notes for AI-powered commentary.
        Rivalry notes help generate more engaging matchup narratives.
      </InfoBanner>

      <div style={styles.grid}>
        {managers.map((manager) => (
          <ManagerCard
            key={manager.id}
            manager={manager}
            onEdit={() => handleEditClick(manager)}
          />
        ))}
      </div>

      {editingManager && (
        <EditManagerModal
          manager={editingManager}
          allManagers={managers}
          onSave={handleSave}
          onClose={() => setEditingManager(null)}
        />
      )}
    </div>
  );
}

function ManagerCard({
  manager,
  onEdit,
}: {
  manager: Manager;
  onEdit: () => void;
}) {
  const isConfigured = manager.displayName || manager.nickname || manager.contextNotes;
  const rivalryCount = manager.rivalryNotes
    ? Object.keys(manager.rivalryNotes).length
    : 0;

  return (
    <div style={isConfigured ? styles.cardConfigured : styles.card}>
      <div style={styles.cardHeader}>
        <div>
          {manager.avatarUrl ? (
            <img src={manager.avatarUrl} alt={manager.username} style={styles.avatar} />
          ) : (
            <div style={styles.avatarPlaceholder}>
              {(manager.displayName || manager.username).charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div style={styles.identity}>
          <div style={styles.name}>
            {manager.displayName || manager.username}
            {manager.nickname && (
              <span style={styles.nickname}>&ldquo;{manager.nickname}&rdquo;</span>
            )}
          </div>
          {manager.displayName && manager.displayName !== manager.username && (
            <div style={styles.username}>@{manager.username}</div>
          )}
        </div>
        <div style={styles.rank}>#{manager.rank}</div>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Record</span>
          <span style={styles.statValue}>
            {manager.career.combined.wins}-{manager.career.combined.losses}
          </span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Win %</span>
          <span style={styles.statValue}>{manager.career.combined.winPct}%</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Avg PF</span>
          <span style={styles.statValue}>{manager.career.points.avgPerWeek}</span>
        </div>
      </div>

      {manager.contextNotes && (
        <div style={styles.contextSection}>
          <div style={styles.contextLabel}>AI Context</div>
          <div style={styles.contextText}>{manager.contextNotes}</div>
        </div>
      )}

      <div style={styles.footer}>
        <div style={styles.configStatus}>
          {isConfigured ? (
            <span style={styles.statusConfigured}>
              ✓ Configured
              {rivalryCount > 0 && ` • ${rivalryCount} rivalries`}
            </span>
          ) : (
            <span style={styles.statusUnconfigured}>Not configured</span>
          )}
        </div>
        <button
          type="button"
          style={styles.button}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}
        >
          Edit
        </button>
      </div>
    </div>
  );
}

function EditManagerModal({
  manager,
  allManagers,
  onSave,
  onClose,
}: {
  manager: Manager;
  allManagers: Manager[];
  onSave: (managerId: string, updates: ManagerUpdates) => Promise<void>;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState(manager.displayName || '');
  const [nickname, setNickname] = useState(manager.nickname || '');
  const [contextNotes, setContextNotes] = useState(manager.contextNotes || '');
  const [rivalryNotes, setRivalryNotes] = useState<Record<string, string>>(
    manager.rivalryNotes || {}
  );
  const [saving, setSaving] = useState(false);

  const otherManagers = allManagers.filter((m) => m.id !== manager.id);

  const handleSubmit = async () => {
    setSaving(true);

    const cleanedRivalries = Object.fromEntries(
      Object.entries(rivalryNotes).filter(([, value]) => value.trim() !== '')
    );

    await onSave(manager.id, {
      display_name: displayName.trim() || undefined,
      nickname: nickname.trim() || undefined,
      context_notes: contextNotes.trim() || undefined,
      rivalry_notes: Object.keys(cleanedRivalries).length > 0 ? cleanedRivalries : undefined,
    });

    setSaving(false);
  };

  const updateRivalry = (managerId: string, note: string) => {
    setRivalryNotes((prev) => ({
      ...prev,
      [managerId]: note,
    }));
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Edit Manager</h2>
          <button style={styles.modalClose} onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div style={styles.modalBody}>
          <div style={styles.formSection}>
            <h3 style={styles.formSectionTitle}>Identity</h3>

            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="displayName">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                style={styles.formInput}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={manager.username}
              />
              <p style={styles.formHint}>
                Used in reports instead of Sleeper username. Leave blank to use @
                {manager.username}
              </p>
            </div>

            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="nickname">
                Nickname
              </label>
              <input
                id="nickname"
                type="text"
                style={styles.formInput}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g., The Tank Commander"
              />
              <p style={styles.formHint}>A fun nickname the AI can use in commentary</p>
            </div>
          </div>

          <div style={styles.formSection}>
            <h3 style={styles.formSectionTitle}>AI Context</h3>

            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="contextNotes">
                Context Notes
              </label>
              <textarea
                id="contextNotes"
                style={styles.formTextarea}
                value={contextNotes}
                onChange={(e) => setContextNotes(e.target.value)}
                rows={4}
                placeholder="e.g., League commissioner, known for making blockbuster trades..."
              />
              <p style={styles.formHint}>
                Background info for the AI to reference in commentary.
              </p>
            </div>
          </div>

          <div style={{ ...styles.formSection, marginBottom: 0 }}>
            <h3 style={styles.formSectionTitle}>Rivalries</h3>
            <p style={styles.sectionHint}>
              Add notes about rivalries for more engaging matchup commentary.
            </p>

            <div style={styles.rivalryList}>
              {otherManagers.map((other) => (
                <div key={other.id} style={styles.rivalryField}>
                  <label style={styles.rivalryLabel}>
                    {other.displayName || other.username}
                  </label>
                  <input
                    type="text"
                    style={styles.rivalryInput}
                    value={rivalryNotes[other.id] || ''}
                    onChange={(e) => updateRivalry(other.id, e.target.value)}
                    placeholder="e.g., Lost 2023 championship to them..."
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={styles.modalFooter}>
          <button
            type="button"
            style={styles.btnGhost}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            style={styles.btnPrimary}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
