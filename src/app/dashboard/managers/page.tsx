'use client'

import { useState, useEffect, useCallback, CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useLeague } from '@/lib/context/LeagueContext'
import {
  SectionHeader,
  InfoBanner,
  LoadingIndicator,
  EmptyState,
} from '@/components/ui'

interface Manager {
  id: string
  sleeperUserId: string
  username: string
  displayName: string | null
  nickname: string | null
  avatarUrl: string | null
  contextNotes: string | null
  rivalryNotes: Record<string, string> | null
  isActive: boolean
  career: {
    totalWeeks: number
    combined: { wins: number; losses: number; winPct: number; rank: number }
    points: { totalPF: number; avgPerWeek: number }
  }
  rank: number
}

interface ManagerUpdates {
  display_name?: string
  nickname?: string
  context_notes?: string
  rivalry_notes?: Record<string, string>
}

export default function ManagersPage() {
  const router = useRouter()
  const { currentLeague, loading: leagueLoading } = useLeague()
  
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingManager, setEditingManager] = useState<Manager | null>(null)

  const fetchManagers = useCallback(async () => {
    if (!currentLeague) return
    
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/leagues/${currentLeague.id}/managers`)
      const result = await response.json()

      if (result.success) {
        setManagers(result.managers)
      } else {
        setError(result.error || 'Failed to fetch managers')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [currentLeague])

  useEffect(() => {
    if (currentLeague) {
      fetchManagers()
    }
  }, [fetchManagers, currentLeague])

  // Redirect to onboarding if no league
  useEffect(() => {
    if (!leagueLoading && !currentLeague) {
      router.push('/onboarding')
    }
  }, [leagueLoading, currentLeague, router])

  const handleSave = async (managerId: string, updates: ManagerUpdates) => {
    if (!currentLeague) return
    
    try {
      const response = await fetch(`/api/leagues/${currentLeague.id}/managers/${managerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      const result = await response.json()

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
        )
        setEditingManager(null)
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      alert(`Failed to save: ${err}`)
    }
  }

  if (leagueLoading || loading) {
    return (
      <div className="page-container">
        <LoadingIndicator message="Loading managers..." />
      </div>
    )
  }

  if (!currentLeague) {
    return (
      <div className="page-container">
        <EmptyState
          title="No League Connected"
          description="Connect your Sleeper league to configure managers."
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container">
        <InfoBanner variant="error">{error}</InfoBanner>
      </div>
    )
  }

  if (managers.length === 0) {
    return (
      <div className="page-container">
        <EmptyState
          title="No managers found"
          description="Try re-syncing your league data from the Sync page."
        />
      </div>
    )
  }

  const configuredCount = managers.filter(
    (m) => m.displayName || m.nickname || m.contextNotes
  ).length

  return (
    <div className="page-container">
      <SectionHeader
        title="Manager Configuration"
        context={`${configuredCount}/${managers.length} configured`}
      />

      <InfoBanner>
        Configure display names, nicknames, and context notes for AI-powered commentary.
        Rivalry notes help generate more engaging matchup narratives.
      </InfoBanner>

      <div className="managers-grid">
        {managers.map((manager) => (
          <ManagerCard
            key={manager.id}
            manager={manager}
            onEdit={() => setEditingManager(manager)}
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

      <style jsx>{`
        .managers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: var(--space-lg);
          margin-top: var(--space-xl);
        }
      `}</style>
    </div>
  )
}

function ManagerCard({
  manager,
  onEdit,
}: {
  manager: Manager
  onEdit: () => void
}) {
  const isConfigured = manager.displayName || manager.nickname || manager.contextNotes
  const rivalryCount = manager.rivalryNotes
    ? Object.keys(manager.rivalryNotes).length
    : 0

  return (
    <div className={`manager-card ${isConfigured ? 'configured' : ''}`}>
      <div className="card-header">
        {manager.avatarUrl ? (
          <img 
            src={manager.avatarUrl} 
            alt={manager.username} 
            className="avatar" 
          />
        ) : (
          <div className="avatar-placeholder">
            {(manager.displayName || manager.username).charAt(0).toUpperCase()}
          </div>
        )}
        <div className="identity">
          <div className="name">
            {manager.displayName || manager.username}
            {manager.nickname && (
              <span className="nickname">&ldquo;{manager.nickname}&rdquo;</span>
            )}
          </div>
          {manager.displayName && manager.displayName !== manager.username && (
            <div className="username">@{manager.username}</div>
          )}
        </div>
        <div className="rank">#{manager.rank}</div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <span className="stat-label">Record</span>
          <span className="stat-value">
            {manager.career.combined.wins}-{manager.career.combined.losses}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Win %</span>
          <span className="stat-value">{manager.career.combined.winPct}%</span>
        </div>
        <div className="stat">
          <span className="stat-label">Avg PF</span>
          <span className="stat-value">{manager.career.points.avgPerWeek}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Weeks</span>
          <span className="stat-value">{manager.career.totalWeeks}</span>
        </div>
      </div>

      {manager.contextNotes && (
        <div className="context-section">
          <div className="context-label">AI Context</div>
          <div className="context-text">{manager.contextNotes}</div>
        </div>
      )}

      <div className="card-footer">
        <div className="config-status">
          {isConfigured ? (
            <span className="status-configured">
              ✓ Configured
              {rivalryCount > 0 && ` • ${rivalryCount} rivalries`}
            </span>
          ) : (
            <span className="status-unconfigured">Not configured</span>
          )}
        </div>
        <button type="button" className="btn-edit" onClick={onEdit}>
          Edit
        </button>
      </div>

      <style jsx>{`
        .manager-card {
          background: var(--surface);
          border: 2px solid var(--border-light);
          padding: var(--space-lg);
          transition: border-color 0.15s ease;
        }
        
        .manager-card.configured {
          border-color: var(--accent-primary);
        }
        
        .card-header {
          display: flex;
          align-items: flex-start;
          gap: var(--space-md);
          margin-bottom: var(--space-md);
        }
        
        .avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--border-light);
        }
        
        .avatar-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--accent-primary);
          color: var(--background);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-serif);
          font-weight: 700;
          font-size: 1.25rem;
        }
        
        .identity {
          flex: 1;
          min-width: 0;
        }
        
        .name {
          font-family: var(--font-serif);
          font-weight: 700;
          font-size: 1rem;
          color: var(--foreground);
          line-height: 1.3;
        }
        
        .nickname {
          display: block;
          font-family: var(--font-sans);
          font-weight: 400;
          font-size: 0.8125rem;
          color: var(--accent-gold);
          font-style: italic;
          margin-top: 2px;
        }
        
        .username {
          font-family: var(--font-sans);
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 2px;
        }
        
        .rank {
          font-family: var(--font-serif);
          font-weight: 700;
          font-size: 0.875rem;
          color: var(--text-muted);
          background: var(--surface-sunken);
          padding: var(--space-xs) var(--space-sm);
        }
        
        .stats-row {
          display: flex;
          gap: var(--space-lg);
          padding: var(--space-md) 0;
          border-top: 1px solid var(--border-light);
          border-bottom: 1px solid var(--border-light);
          margin-bottom: var(--space-md);
        }
        
        .stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .stat-label {
          font-family: var(--font-sans);
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        
        .stat-value {
          font-family: var(--font-sans);
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--foreground);
        }
        
        .context-section {
          margin-bottom: var(--space-md);
        }
        
        .context-label {
          font-family: var(--font-sans);
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 4px;
        }
        
        .context-text {
          font-family: var(--font-sans);
          font-size: 0.8125rem;
          color: var(--foreground);
          line-height: 1.5;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }
        
        .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .config-status {
          font-family: var(--font-sans);
          font-size: 0.75rem;
        }
        
        .status-configured {
          color: var(--win);
        }
        
        .status-unconfigured {
          color: var(--text-muted);
        }
        
        .btn-edit {
          padding: var(--space-sm) var(--space-lg);
          font-family: var(--font-sans);
          font-size: 0.8125rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border: 2px solid var(--accent-primary);
          background: transparent;
          color: var(--accent-primary);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        
        .btn-edit:hover {
          background: var(--accent-primary);
          color: var(--background);
        }
      `}</style>
    </div>
  )
}

function EditManagerModal({
  manager,
  allManagers,
  onSave,
  onClose,
}: {
  manager: Manager
  allManagers: Manager[]
  onSave: (managerId: string, updates: ManagerUpdates) => Promise<void>
  onClose: () => void
}) {
  const [displayName, setDisplayName] = useState(manager.displayName || '')
  const [nickname, setNickname] = useState(manager.nickname || '')
  const [contextNotes, setContextNotes] = useState(manager.contextNotes || '')
  const [rivalryNotes, setRivalryNotes] = useState<Record<string, string>>(
    manager.rivalryNotes || {}
  )
  const [saving, setSaving] = useState(false)

  const otherManagers = allManagers.filter((m) => m.id !== manager.id)

  const handleSubmit = async () => {
    setSaving(true)

    const cleanedRivalries = Object.fromEntries(
      Object.entries(rivalryNotes).filter(([, value]) => value.trim() !== '')
    )

    await onSave(manager.id, {
      display_name: displayName.trim() || undefined,
      nickname: nickname.trim() || undefined,
      context_notes: contextNotes.trim() || undefined,
      rivalry_notes: Object.keys(cleanedRivalries).length > 0 ? cleanedRivalries : undefined,
    })

    setSaving(false)
  }

  const updateRivalry = (managerId: string, note: string) => {
    setRivalryNotes((prev) => ({
      ...prev,
      [managerId]: note,
    }))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Manager</h2>
          <button className="modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-section">
            <h3 className="section-title">Identity</h3>

            <div className="form-field">
              <label htmlFor="displayName">Display Name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={manager.username}
              />
              <p className="form-hint">
                Used in reports instead of Sleeper username
              </p>
            </div>

            <div className="form-field">
              <label htmlFor="nickname">Nickname</label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g., The Tank Commander"
              />
              <p className="form-hint">A fun nickname the AI can use in commentary</p>
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-title">AI Context</h3>

            <div className="form-field">
              <label htmlFor="contextNotes">Context Notes</label>
              <textarea
                id="contextNotes"
                value={contextNotes}
                onChange={(e) => setContextNotes(e.target.value)}
                rows={4}
                placeholder="e.g., League commissioner, known for making blockbuster trades..."
              />
              <p className="form-hint">
                Background info for the AI to reference in commentary
              </p>
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-title">Rivalries</h3>
            <p className="section-hint">
              Add notes about rivalries for more engaging matchup commentary.
            </p>

            <div className="rivalry-list">
              {otherManagers.map((other) => (
                <div key={other.id} className="rivalry-field">
                  <label>{other.displayName || other.username}</label>
                  <input
                    type="text"
                    value={rivalryNotes[other.id] || ''}
                    onChange={(e) => updateRivalry(other.id, e.target.value)}
                    placeholder="e.g., Lost 2023 championship to them..."
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn-save" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: var(--space-lg);
        }
        
        .modal {
          background: var(--background);
          border: 3px solid var(--accent-secondary);
          max-width: 640px;
          width: 100%;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-lg);
          border-bottom: 2px solid var(--border-light);
          background: var(--surface);
        }
        
        .modal-title {
          font-family: var(--font-serif);
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--accent-primary);
          margin: 0;
        }
        
        .modal-close {
          background: none;
          border: none;
          font-size: 1.75rem;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        
        .modal-close:hover {
          color: var(--foreground);
        }
        
        .modal-body {
          padding: var(--space-lg);
          overflow-y: auto;
          flex: 1;
        }
        
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-md);
          padding: var(--space-lg);
          border-top: 2px solid var(--border-light);
          background: var(--surface);
        }
        
        .form-section {
          margin-bottom: var(--space-xl);
        }
        
        .form-section:last-child {
          margin-bottom: 0;
        }
        
        .section-title {
          font-family: var(--font-serif);
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--accent-primary);
          margin: 0 0 var(--space-md);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .section-hint {
          font-size: 0.8125rem;
          color: var(--text-muted);
          margin: 0 0 var(--space-md);
        }
        
        .form-field {
          margin-bottom: var(--space-md);
        }
        
        .form-field label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--foreground);
          margin-bottom: var(--space-xs);
        }
        
        .form-field input,
        .form-field textarea {
          width: 100%;
          padding: var(--space-sm) var(--space-md);
          font-size: 0.875rem;
          color: var(--foreground);
          background: var(--surface);
          border: 1px solid var(--border-light);
          box-sizing: border-box;
        }
        
        .form-field input:focus,
        .form-field textarea:focus {
          outline: none;
          border-color: var(--accent-primary);
        }
        
        .form-field textarea {
          resize: vertical;
          min-height: 80px;
        }
        
        .form-hint {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin: var(--space-xs) 0 0;
        }
        
        .rivalry-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }
        
        .rivalry-field {
          display: grid;
          grid-template-columns: 140px 1fr;
          gap: var(--space-md);
          align-items: center;
        }
        
        .rivalry-field label {
          font-size: 0.8125rem;
          color: var(--foreground);
          text-align: right;
        }
        
        .rivalry-field input {
          padding: var(--space-xs) var(--space-sm);
          font-size: 0.8125rem;
          color: var(--foreground);
          background: var(--surface);
          border: 1px solid var(--border-light);
        }
        
        .btn-cancel {
          padding: var(--space-sm) var(--space-lg);
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border: 2px solid transparent;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
        }
        
        .btn-cancel:hover {
          color: var(--foreground);
        }
        
        .btn-save {
          padding: var(--space-sm) var(--space-lg);
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border: 2px solid var(--accent-primary);
          background: var(--accent-primary);
          color: var(--background);
          cursor: pointer;
        }
        
        .btn-save:hover:not(:disabled) {
          background: var(--accent-secondary);
          border-color: var(--accent-secondary);
        }
        
        .btn-save:disabled,
        .btn-cancel:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
