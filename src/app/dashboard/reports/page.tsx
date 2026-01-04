'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useLeague } from '@/lib/context/LeagueContext'
import {
  Button,
  InfoBanner,
  LoadingIndicator,
} from '@/components/ui'
import {
  VoicePreset,
  ReportTemplate,
  VOICE_PRESETS,
  REPORT_TEMPLATES,
} from '@/lib/ai/prompts'
import { printIframe } from '@/lib/pdf'

type ReportType = 'weekly' | 'postseason'

interface ReportSection {
  id: string
  title: string
  enabled: boolean
}

const DEFAULT_SECTIONS: ReportSection[] = [
  { id: 'standings', title: 'Standings', enabled: true },
  { id: 'matchups', title: 'Matchups', enabled: true },
  { id: 'awards', title: 'Awards', enabled: true },
  { id: 'powerRankings', title: 'Power Rankings', enabled: false },
  { id: 'playoffPicture', title: 'Playoff Picture', enabled: true },
  { id: 'transactions', title: 'Transactions', enabled: false },
]

interface GenerationProgress {
  status: 'idle' | 'generating' | 'complete' | 'error'
  currentSection?: string
  message?: string
}

export default function ReportsPage() {
  const router = useRouter()
  const { currentLeague, loading: leagueLoading } = useLeague()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Report Configuration
  const [reportType, setReportType] = useState<ReportType>('weekly')
  const [season, setSeason] = useState('')
  const [week, setWeek] = useState('')
  const [template, setTemplate] = useState<ReportTemplate>('standard')
  const [voice, setVoice] = useState<VoicePreset>('supreme_leader')
  const [customVoice, setCustomVoice] = useState('')
  const [sections, setSections] = useState<ReportSection[]>(DEFAULT_SECTIONS)
  const [useAiCommentary, setUseAiCommentary] = useState(true)
  
  // Mobile UI state
  const [showConfig, setShowConfig] = useState(false)
  const [showSectionsExpanded, setShowSectionsExpanded] = useState(false)

  // Generation State
  const [progress, setProgress] = useState<GenerationProgress>({ status: 'idle' })
  const [reportUrl, setReportUrl] = useState<string | null>(null)
  const [reportHtml, setReportHtml] = useState<string | null>(null)
  const [editedHtml, setEditedHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)

  // Build week options
  const getWeekOptions = useCallback(() => {
    const options = []
    for (let i = 1; i <= 14; i++) {
      options.push({ value: String(i), label: `Week ${i}` })
    }
    options.push({ value: '15', label: 'Playoffs R1' })
    options.push({ value: '16', label: 'Playoffs R2' })
    options.push({ value: '17', label: 'Championship' })
    return options
  }, [])

  const getSeasonOptions = useCallback(() => {
    if (!currentLeague) return []
    const options = []
    for (let year = currentLeague.current_season; year >= currentLeague.first_season; year--) {
      options.push({ value: String(year), label: String(year) })
    }
    return options
  }, [currentLeague])

  useEffect(() => {
    if (currentLeague) {
      setSeason(String(currentLeague.current_season))
      setWeek('14')
    }
  }, [currentLeague])

  useEffect(() => {
    if (!leagueLoading && !currentLeague) {
      router.push('/onboarding')
    }
  }, [leagueLoading, currentLeague, router])

  // Listen for WYSIWYG changes from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'contentChange' && event.data?.html) {
        setEditedHtml(event.data.html)
        setHasUnsavedChanges(true)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const toggleSection = (sectionId: string) => {
    setSections(prev => prev.map(s => 
      s.id === sectionId ? { ...s, enabled: !s.enabled } : s
    ))
  }

  const getSectionsConfig = () => {
    const config: Record<string, { enabled: boolean }> = {}
    sections.forEach(s => {
      config[s.id] = { enabled: s.enabled }
    })
    return config
  }

  const enabledSectionsCount = sections.filter(s => s.enabled).length

  // Make HTML editable by adding contenteditable attributes
  const makeEditable = (html: string): string => {
    // Add contenteditable to key elements
    return html
      .replace(/<p>/g, '<p contenteditable="true">')
      .replace(/<div class="callout/g, '<div contenteditable="true" class="callout')
      .replace(/<div class="highlight-box/g, '<div contenteditable="true" class="highlight-box')
      .replace(/<div class="matchup-commentary/g, '<div contenteditable="true" class="matchup-commentary')
      .replace(/<h1 class="report-title/g, '<h1 contenteditable="true" class="report-title')
      .replace(/<\/head>/, `
        <script>
          document.addEventListener('input', function(e) {
            if (e.target.hasAttribute('contenteditable')) {
              window.parent?.postMessage({
                type: 'contentChange',
                html: document.querySelector('.report-container').innerHTML
              }, '*');
            }
          });
        </script>
        </head>
      `)
  }

  const generateReport = async () => {
    if (!currentLeague) return
    
    setShowConfig(false)
    setProgress({ status: 'generating', currentSection: 'Initializing...' })
    setError(null)
    setReportUrl(null)
    setReportHtml(null)
    setEditedHtml(null)
    setHasUnsavedChanges(false)

    try {
      const baseUrl = `/api/leagues/${currentLeague.id}/reports/${reportType}`
      
      setProgress({ status: 'generating', currentSection: 'Checking data...' })
      const checkUrl = `${baseUrl}?season=${season}${reportType === 'weekly' ? `&week=${week}` : ''}&format=json`
      const checkResponse = await fetch(checkUrl)
      const checkData = await checkResponse.json()

      if (!checkData.success) {
        throw new Error(checkData.error || 'Failed to generate report')
      }

      setProgress({ 
        status: 'generating', 
        currentSection: useAiCommentary ? 'Generating AI commentary...' : 'Building report...'
      })
      
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season: parseInt(season),
          week: parseInt(week),
          sections: getSectionsConfig(),
          voice,
          template,
          customVoice: voice === 'custom' ? customVoice : undefined,
          useAiCommentary,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate report')
      }

      const html = await response.text()
      const editableHtml = makeEditable(html)
      setReportHtml(editableHtml)
      
      const blob = new Blob([editableHtml], { type: 'text/html' })
      const blobUrl = URL.createObjectURL(blob)
      setReportUrl(blobUrl)
      setGeneratedAt(new Date())
      
      setProgress({ status: 'complete' })
    } catch (err) {
      setError(String(err))
      setProgress({ status: 'error', message: String(err) })
    }
  }

  const saveDraft = async () => {
    if (!currentLeague) return
    
    setIsSaving(true)
    setSaveMessage(null)
    
    try {
      const response = await fetch(`/api/leagues/${currentLeague.id}/reports/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season: parseInt(season),
          week: reportType === 'weekly' ? parseInt(week) : null,
          reportType,
          html: editedHtml || reportHtml,
          config: {
            template,
            voice,
            customVoice: voice === 'custom' ? customVoice : undefined,
            useAiCommentary,
            sections: getSectionsConfig(),
          },
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to save draft')
      }
      
      setHasUnsavedChanges(false)
      setSaveMessage('Draft saved!')
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      setSaveMessage('Failed to save')
      setTimeout(() => setSaveMessage(null), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const exportPdf = () => {
    if (iframeRef.current) {
      printIframe(iframeRef.current)
    }
  }

  const copyHtml = async () => {
    const htmlToExport = editedHtml || reportHtml
    if (!htmlToExport) return
    await navigator.clipboard.writeText(htmlToExport)
    setSaveMessage('Copied!')
    setTimeout(() => setSaveMessage(null), 2000)
  }

  const downloadHtml = () => {
    const htmlToExport = editedHtml || reportHtml
    if (!htmlToExport) return
    const blob = new Blob([htmlToExport], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${season}-week${week}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    return () => {
      if (reportUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(reportUrl)
      }
    }
  }, [reportUrl])

  const weekOptions = getWeekOptions()
  const seasonOptions = getSeasonOptions()
  const isGenerating = progress.status === 'generating'
  const hasReport = progress.status === 'complete' && reportUrl

  if (leagueLoading) {
    return (
      <div className="loading-container">
        <LoadingIndicator message="Loading..." />
      </div>
    )
  }

  if (!currentLeague) return null

  return (
    <div className="reports-page">
      {/* Header */}
      <header className="page-header">
        <h1>{currentLeague.name}</h1>
        <p className="header-meta">{currentLeague.team_count} Teams • {currentLeague.first_season}–{currentLeague.current_season}</p>
      </header>

      {/* Main Layout */}
      <div className="main-layout">
        {/* Left: Configuration Panel */}
        <aside className={`config-panel ${isGenerating ? 'disabled' : ''} ${showConfig ? 'mobile-open' : ''}`}>
          <div className="config-mobile-header">
            <span>Report Settings</span>
            <button onClick={() => setShowConfig(false)} className="close-btn">✕</button>
          </div>
          
          <div className="config-content">
            {/* Report Type Toggle */}
            <div className="config-section">
              <div className="toggle-group">
                <button 
                  className={`toggle-btn ${reportType === 'weekly' ? 'active' : ''}`}
                  onClick={() => setReportType('weekly')}
                  disabled={isGenerating}
                >
                  Weekly
                </button>
                <button 
                  className={`toggle-btn ${reportType === 'postseason' ? 'active' : ''}`}
                  onClick={() => setReportType('postseason')}
                  disabled={isGenerating}
                >
                  Postseason
                </button>
              </div>
            </div>

            {/* Week & Season */}
            <div className="config-section">
              <div className="field-row">
                {reportType === 'weekly' && (
                  <div className="field">
                    <label htmlFor="week-select">Week</label>
                    <select 
                      id="week-select"
                      value={week} 
                      onChange={(e) => setWeek(e.target.value)} 
                      disabled={isGenerating}
                    >
                      {weekOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label htmlFor="season-select">Season</label>
                  <select 
                    id="season-select"
                    value={season} 
                    onChange={(e) => setSeason(e.target.value)} 
                    disabled={isGenerating}
                  >
                    {seasonOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Template */}
            <div className="config-section">
              <div className="field">
                <label htmlFor="template-select">Template</label>
                <select 
                  id="template-select"
                  value={template} 
                  onChange={(e) => setTemplate(e.target.value as ReportTemplate)} 
                  disabled={isGenerating}
                >
                  {Object.values(REPORT_TEMPLATES).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <span className="field-hint">{REPORT_TEMPLATES[template].description}</span>
              </div>
            </div>

            {/* Voice */}
            <div className="config-section">
              <div className="field">
                <label htmlFor="voice-select">Voice</label>
                <select 
                  id="voice-select"
                  value={voice} 
                  onChange={(e) => setVoice(e.target.value as VoicePreset)} 
                  disabled={isGenerating}
                >
                  {Object.values(VOICE_PRESETS).map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <span className="field-hint">{VOICE_PRESETS[voice].description}</span>
              </div>
            </div>

            {voice === 'custom' && (
              <div className="config-section">
                <div className="field">
                  <label htmlFor="custom-voice">Custom Voice Description</label>
                  <textarea
                    id="custom-voice"
                    value={customVoice}
                    onChange={(e) => setCustomVoice(e.target.value.slice(0, 150))}
                    placeholder="Describe your custom voice..."
                    maxLength={150}
                    disabled={isGenerating}
                  />
                  <span className="field-hint">{customVoice.length}/150 characters</span>
                </div>
              </div>
            )}

            {/* AI Toggle */}
            <div className="config-section">
              <label className="checkbox-row">
                <input 
                  type="checkbox"
                  checked={useAiCommentary}
                  onChange={() => setUseAiCommentary(!useAiCommentary)}
                  disabled={isGenerating}
                />
                <span className="checkbox-label">
                  <strong>AI Commentary</strong>
                  <small>Generate narrative analysis with Claude</small>
                </span>
              </label>
            </div>

            {/* Sections */}
            <div className="config-section">
              <button 
                className="sections-toggle"
                onClick={() => setShowSectionsExpanded(!showSectionsExpanded)}
              >
                <span>Sections</span>
                <span className="sections-badge">{enabledSectionsCount}/{sections.length}</span>
                <span className={`chevron ${showSectionsExpanded ? 'open' : ''}`}>▼</span>
              </button>
              {showSectionsExpanded && (
                <div className="sections-list">
                  {sections.map(section => (
                    <label key={section.id} className="section-item">
                      <input 
                        type="checkbox"
                        checked={section.enabled}
                        onChange={() => toggleSection(section.id)}
                        disabled={isGenerating}
                      />
                      <span>{section.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Generate Button */}
            <div className="config-section">
              <button 
                className="btn-generate"
                onClick={generateReport}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <span className="spinner" />
                    Generating...
                  </>
                ) : (
                  'Generate Report'
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* Center: Preview */}
        <main className="preview-panel">
          {/* Mobile header bar */}
          <div className="preview-toolbar">
            <button 
              className="toolbar-btn config-toggle"
              onClick={() => setShowConfig(true)}
            >
              ⚙️ Settings
            </button>
            <div className="toolbar-context">
              {season} {reportType === 'weekly' ? `• Week ${week}` : '• Postseason'}
            </div>
            {hasReport && (
              <button className="toolbar-btn" onClick={exportPdf}>
                Export PDF
              </button>
            )}
          </div>

          {/* Preview Content */}
          <div className="preview-content">
            {progress.status === 'idle' && !reportUrl && (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <h3>Create Your Report</h3>
                <p>Configure settings and click Generate to create your weekly report</p>
                <button className="btn-generate-cta" onClick={() => setShowConfig(true)}>
                  Configure & Generate
                </button>
              </div>
            )}

            {progress.status === 'generating' && (
              <div className="loading-state">
                <div className="skeleton">
                  <div className="sk-header" />
                  <div className="sk-subheader" />
                  <div className="sk-row">
                    <div className="sk-box" />
                    <div className="sk-box" />
                  </div>
                  <div className="sk-line" />
                  <div className="sk-line short" />
                  <div className="sk-line" />
                </div>
                <div className="progress-indicator">
                  <span className="spinner" />
                  <span>{progress.currentSection}</span>
                </div>
              </div>
            )}

            {progress.status === 'error' && (
              <div className="error-state">
                <InfoBanner variant="error">{error}</InfoBanner>
                <Button onClick={generateReport}>Retry</Button>
              </div>
            )}

            {hasReport && (
              <div className="report-wrapper">
                <div className="wysiwyg-hint">
                  <span>✏️ Click any text to edit directly</span>
                  {hasUnsavedChanges && <span className="unsaved-badge">Unsaved changes</span>}
                </div>
                <iframe
                  ref={iframeRef}
                  src={reportUrl}
                  className="report-frame"
                  title="Report Preview"
                />
              </div>
            )}
          </div>
        </main>

        {/* Right: Actions Panel */}
        <aside className="actions-panel">
          {!hasReport ? (
            <div className="panel-empty">
              <p>Generate a report to see actions</p>
            </div>
          ) : (
            <>
              {/* Export Section */}
              <div className="panel-section">
                <h4>Export</h4>
                <button className="action-btn primary" onClick={exportPdf}>
                  📥 Download PDF
                </button>
                <button className="action-btn" onClick={downloadHtml}>
                  💾 Save HTML
                </button>
                <button className="action-btn" onClick={copyHtml}>
                  📋 Copy HTML
                </button>
              </div>

              {/* Save Section */}
              <div className="panel-section">
                <h4>Draft</h4>
                <button 
                  className={`action-btn ${hasUnsavedChanges ? 'highlight' : ''}`}
                  onClick={saveDraft}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : hasUnsavedChanges ? '💾 Save Changes' : '💾 Save Draft'}
                </button>
                {saveMessage && <span className="save-message">{saveMessage}</span>}
              </div>

              {/* Report Info */}
              <div className="panel-section">
                <h4>Report Info</h4>
                <dl className="info-list">
                  <dt>Template</dt>
                  <dd>{REPORT_TEMPLATES[template].name}</dd>
                  <dt>Voice</dt>
                  <dd>{VOICE_PRESETS[voice].name}</dd>
                  <dt>AI Commentary</dt>
                  <dd>{useAiCommentary ? 'Enabled' : 'Disabled'}</dd>
                  <dt>Generated</dt>
                  <dd>{generatedAt?.toLocaleTimeString() || '—'}</dd>
                </dl>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Mobile backdrop */}
      {showConfig && <div className="mobile-backdrop" onClick={() => setShowConfig(false)} />}

      <style jsx>{`
        .reports-page {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 60px);
          overflow: hidden;
        }

        .loading-container {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        /* Page Header */
        .page-header {
          padding: 16px 24px;
          background: var(--accent-primary);
          color: white;
        }

        .page-header h1 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .header-meta {
          margin: 4px 0 0;
          font-size: 0.8125rem;
          opacity: 0.85;
        }

        /* Main Layout */
        .main-layout {
          display: grid;
          grid-template-columns: 260px 1fr 220px;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        /* Config Panel */
        .config-panel {
          background: var(--surface);
          border-right: 1px solid var(--border-light);
          overflow-y: auto;
        }

        .config-panel.disabled {
          opacity: 0.5;
          pointer-events: none;
        }

        .config-mobile-header {
          display: none;
        }

        .config-content {
          padding: 16px;
        }

        .config-section {
          margin-bottom: 20px;
        }

        .config-section:last-child {
          margin-bottom: 0;
        }

        /* Toggle Group */
        .toggle-group {
          display: flex;
          background: var(--surface-sunken);
          border-radius: 6px;
          padding: 3px;
        }

        .toggle-btn {
          flex: 1;
          padding: 10px 12px;
          font-size: 0.875rem;
          font-weight: 500;
          background: none;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .toggle-btn.active {
          background: white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          color: var(--accent-primary);
        }

        /* Fields */
        .field-row {
          display: flex;
          gap: 12px;
        }

        .field {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .field select,
        .field textarea {
          width: 100%;
          padding: 10px 12px;
          font-size: 0.9375rem;
          border: 1px solid var(--border-light);
          border-radius: 6px;
          background: white;
        }

        .field select:focus,
        .field textarea:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(45, 80, 22, 0.1);
        }

        .field textarea {
          min-height: 80px;
          resize: vertical;
        }

        .field-hint {
          font-size: 0.75rem;
          color: var(--text-muted);
          line-height: 1.4;
        }

        /* Checkbox Row */
        .checkbox-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
          padding: 12px;
          background: var(--surface-sunken);
          border-radius: 8px;
          transition: background 0.15s;
        }

        .checkbox-row:hover {
          background: var(--border-light);
        }

        .checkbox-row input {
          width: 18px;
          height: 18px;
          margin-top: 2px;
          accent-color: var(--accent-primary);
        }

        .checkbox-label {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .checkbox-label strong {
          font-size: 0.9375rem;
        }

        .checkbox-label small {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* Sections Toggle */
        .sections-toggle {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 10px 12px;
          font-size: 0.875rem;
          font-weight: 500;
          background: var(--surface-sunken);
          border: 1px solid var(--border-light);
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .sections-toggle:hover {
          background: var(--border-light);
        }

        .sections-badge {
          margin-left: auto;
          padding: 2px 8px;
          font-size: 0.75rem;
          background: var(--accent-primary);
          color: white;
          border-radius: 10px;
        }

        .chevron {
          margin-left: 8px;
          font-size: 0.625rem;
          transition: transform 0.2s;
        }

        .chevron.open {
          transform: rotate(180deg);
        }

        .sections-list {
          margin-top: 8px;
          padding: 8px;
          background: white;
          border: 1px solid var(--border-light);
          border-radius: 6px;
        }

        .section-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          font-size: 0.875rem;
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.15s;
        }

        .section-item:hover {
          background: var(--surface-sunken);
        }

        .section-item input {
          accent-color: var(--accent-primary);
        }

        /* Generate Button */
        .btn-generate {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px;
          font-size: 1rem;
          font-weight: 600;
          background: var(--accent-primary);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .btn-generate:hover:not(:disabled) {
          background: var(--accent-secondary);
        }

        .btn-generate:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Preview Panel */
        .preview-panel {
          display: flex;
          flex-direction: column;
          background: var(--surface-sunken);
          overflow: hidden;
        }

        .preview-toolbar {
          display: none;
        }

        .preview-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow: hidden;
        }

        .empty-state,
        .loading-state,
        .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
          padding: 24px;
        }

        .empty-icon {
          font-size: 4rem;
          opacity: 0.4;
        }

        .empty-state h3 {
          margin: 0;
          font-size: 1.25rem;
          color: var(--foreground);
        }

        .empty-state p {
          margin: 0;
          font-size: 0.9375rem;
          color: var(--text-muted);
          max-width: 280px;
        }

        .btn-generate-cta {
          margin-top: 12px;
          padding: 14px 28px;
          font-size: 1rem;
          font-weight: 600;
          background: var(--accent-primary);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }

        .btn-generate-cta:hover {
          background: var(--accent-secondary);
        }

        /* Skeleton Loading */
        .skeleton {
          width: 360px;
          max-width: 100%;
          padding: 24px;
          background: var(--surface);
          border: 1px solid var(--border-light);
          border-radius: 12px;
        }

        .sk-header {
          width: 50%;
          height: 24px;
          background: var(--border-light);
          margin-bottom: 8px;
          border-radius: 4px;
          animation: pulse 1.5s infinite;
        }

        .sk-subheader {
          width: 35%;
          height: 16px;
          background: var(--border-light);
          margin-bottom: 24px;
          border-radius: 4px;
          animation: pulse 1.5s infinite;
        }

        .sk-row {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
        }

        .sk-box {
          flex: 1;
          height: 70px;
          background: var(--border-light);
          border-radius: 6px;
          animation: pulse 1.5s infinite;
        }

        .sk-line {
          width: 100%;
          height: 14px;
          background: var(--border-light);
          margin-bottom: 10px;
          border-radius: 4px;
          animation: pulse 1.5s infinite;
        }

        .sk-line.short {
          width: 70%;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }

        .progress-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
          font-size: 0.9375rem;
          color: var(--accent-primary);
          font-weight: 500;
        }

        .progress-indicator .spinner {
          border-color: var(--border-light);
          border-top-color: var(--accent-primary);
        }

        /* Report Wrapper with WYSIWYG hint */
        .report-wrapper {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
        }

        .wysiwyg-hint {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          font-size: 0.8125rem;
          color: var(--text-muted);
          background: var(--surface);
          border: 1px solid var(--border-light);
          border-bottom: none;
          border-radius: 8px 8px 0 0;
        }

        .unsaved-badge {
          padding: 2px 8px;
          font-size: 0.75rem;
          background: #fef3c7;
          color: #92400e;
          border-radius: 4px;
        }

        .report-frame {
          flex: 1;
          width: 100%;
          border: 1px solid var(--border-light);
          border-radius: 0 0 8px 8px;
          background: white;
        }

        /* Actions Panel */
        .actions-panel {
          background: var(--surface);
          border-left: 1px solid var(--border-light);
          padding: 20px;
          overflow-y: auto;
        }

        .panel-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
          font-style: italic;
          text-align: center;
        }

        .panel-section {
          margin-bottom: 24px;
        }

        .panel-section:last-child {
          margin-bottom: 0;
        }

        .panel-section h4 {
          margin: 0 0 12px;
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-muted);
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 12px;
          margin-bottom: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          background: white;
          border: 1px solid var(--border-light);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .action-btn:last-child {
          margin-bottom: 0;
        }

        .action-btn:hover {
          background: var(--surface-sunken);
          border-color: var(--border-dark);
        }

        .action-btn.primary {
          background: var(--accent-primary);
          color: white;
          border-color: var(--accent-primary);
        }

        .action-btn.primary:hover {
          background: var(--accent-secondary);
        }

        .action-btn.highlight {
          background: #fef3c7;
          border-color: #f59e0b;
          color: #92400e;
        }

        .action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .save-message {
          display: block;
          margin-top: 8px;
          font-size: 0.75rem;
          color: var(--accent-primary);
          text-align: center;
        }

        .info-list {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 6px 12px;
          margin: 0;
          font-size: 0.8125rem;
        }

        .info-list dt {
          color: var(--text-muted);
        }

        .info-list dd {
          margin: 0;
          font-weight: 500;
        }

        .mobile-backdrop {
          display: none;
        }

        /* ═══════════════════════════════════════════════════════════════
           TABLET BREAKPOINT (1024px)
           ═══════════════════════════════════════════════════════════════ */
        @media (max-width: 1024px) {
          .main-layout {
            grid-template-columns: 240px 1fr;
          }

          .actions-panel {
            display: none;
          }

          .preview-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 16px;
            background: var(--surface);
            border-bottom: 1px solid var(--border-light);
          }

          .toolbar-btn {
            padding: 8px 14px;
            font-size: 0.8125rem;
            font-weight: 500;
            background: white;
            border: 1px solid var(--border-light);
            border-radius: 6px;
            cursor: pointer;
          }

          .toolbar-btn.config-toggle {
            display: none;
          }

          .toolbar-context {
            font-size: 0.875rem;
            color: var(--text-muted);
          }

          .preview-content {
            padding: 16px;
          }
        }

        /* ═══════════════════════════════════════════════════════════════
           MOBILE BREAKPOINT (768px)
           ═══════════════════════════════════════════════════════════════ */
        @media (max-width: 768px) {
          .reports-page {
            height: calc(100vh - 56px);
          }

          .page-header {
            padding: 12px 16px;
          }

          .page-header h1 {
            font-size: 1.125rem;
          }

          .main-layout {
            grid-template-columns: 1fr;
          }

          /* Config Panel - Slide-up sheet */
          .config-panel {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            max-height: 85vh;
            border-right: none;
            border-top: 1px solid var(--border-light);
            border-radius: 16px 16px 0 0;
            box-shadow: 0 -4px 24px rgba(0,0,0,0.15);
            transform: translateY(100%);
            transition: transform 0.3s ease;
            z-index: 200;
          }

          .config-panel.mobile-open {
            transform: translateY(0);
          }

          .config-mobile-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            font-size: 1.125rem;
            font-weight: 600;
            border-bottom: 1px solid var(--border-light);
          }

          .close-btn {
            width: 36px;
            height: 36px;
            font-size: 1.25rem;
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
          }

          .config-content {
            padding: 20px;
            max-height: calc(85vh - 70px);
            overflow-y: auto;
          }

          .preview-toolbar .config-toggle {
            display: flex;
          }

          .mobile-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.4);
            z-index: 150;
          }

          .preview-content {
            padding: 12px;
          }

          .wysiwyg-hint {
            font-size: 0.75rem;
            padding: 6px 10px;
          }
        }

        /* ═══════════════════════════════════════════════════════════════
           SMALL MOBILE (480px)
           ═══════════════════════════════════════════════════════════════ */
        @media (max-width: 480px) {
          .field-row {
            flex-direction: column;
          }

          .skeleton {
            width: 100%;
          }

          .empty-state h3 {
            font-size: 1.125rem;
          }

          .empty-icon {
            font-size: 3rem;
          }
        }
      `}</style>
    </div>
  )
}
