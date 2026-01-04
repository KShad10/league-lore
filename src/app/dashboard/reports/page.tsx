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

  // Generation State
  const [progress, setProgress] = useState<GenerationProgress>({ status: 'idle' })
  const [reportUrl, setReportUrl] = useState<string | null>(null)
  const [reportHtml, setReportHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  // Build season options from league
  const getSeasonOptions = useCallback(() => {
    if (!currentLeague) return []
    const options = []
    for (let year = currentLeague.current_season; year >= currentLeague.first_season; year--) {
      options.push({ value: String(year), label: String(year) })
    }
    return options
  }, [currentLeague])

  // Initialize defaults when league loads
  useEffect(() => {
    if (currentLeague) {
      setSeason(String(currentLeague.current_season))
      setWeek('14')
    }
  }, [currentLeague])

  // Redirect if no league
  useEffect(() => {
    if (!leagueLoading && !currentLeague) {
      router.push('/onboarding')
    }
  }, [leagueLoading, currentLeague, router])

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

  const generateReport = async () => {
    if (!currentLeague) return
    
    setProgress({ status: 'generating', currentSection: 'Initializing...' })
    setError(null)
    setReportUrl(null)
    setReportHtml(null)

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
      setReportHtml(html)
      
      const blob = new Blob([html], { type: 'text/html' })
      const blobUrl = URL.createObjectURL(blob)
      setReportUrl(blobUrl)
      
      setProgress({ status: 'complete' })
    } catch (err) {
      setError(String(err))
      setProgress({ status: 'error', message: String(err) })
    }
  }

  const exportPdf = () => {
    if (iframeRef.current) {
      printIframe(iframeRef.current)
    }
  }

  const copyHtml = async () => {
    if (!reportHtml) return
    try {
      await navigator.clipboard.writeText(reportHtml)
    } catch (err) {
      setError(`Copy failed: ${err}`)
    }
  }

  const downloadHtml = async () => {
    if (!reportHtml) return
    try {
      const blob = new Blob([reportHtml], { type: 'text/html' })
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `report-${season}-${reportType === 'weekly' ? `week${week}` : 'postseason'}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      setError(`Download failed: ${err}`)
    }
  }

  useEffect(() => {
    return () => {
      if (reportUrl && reportUrl.startsWith('blob:')) {
        URL.revokeObjectURL(reportUrl)
      }
    }
  }, [reportUrl])

  const selectedVoice = VOICE_PRESETS[voice]
  const selectedTemplate = REPORT_TEMPLATES[template]
  const weekOptions = getWeekOptions()
  const seasonOptions = getSeasonOptions()
  const isGenerating = progress.status === 'generating'

  if (leagueLoading) {
    return (
      <div className="reports-loading">
        <LoadingIndicator message="Loading..." />
      </div>
    )
  }

  if (!currentLeague) {
    return null
  }

  return (
    <div className="reports-page">
      {/* Compact Header */}
      <header className="reports-header">
        <div className="header-left">
          <h1>{currentLeague.name}</h1>
          <span className="header-meta">{currentLeague.total_rosters} Teams • {currentLeague.first_season}–{currentLeague.current_season}</span>
        </div>
      </header>

      <div className="reports-container">
        {/* Left Panel: Compact Configuration */}
        <aside className="config-panel">
          {/* Row 1: Scope */}
          <div className="config-row">
            <div className="config-group">
              <label>Type</label>
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
            <div className="config-group">
              <label>Season</label>
              <select value={season} onChange={(e) => setSeason(e.target.value)} disabled={isGenerating}>
                {seasonOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {reportType === 'weekly' && (
              <div className="config-group">
                <label>Week</label>
                <select value={week} onChange={(e) => setWeek(e.target.value)} disabled={isGenerating}>
                  {weekOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Row 2: Template & Voice */}
          <div className="config-row">
            <div className="config-group flex-1">
              <label>Template</label>
              <select value={template} onChange={(e) => setTemplate(e.target.value as ReportTemplate)} disabled={isGenerating}>
                {Object.values(REPORT_TEMPLATES).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="config-group flex-1">
              <label>Voice</label>
              <select value={voice} onChange={(e) => setVoice(e.target.value as VoicePreset)} disabled={isGenerating}>
                {Object.values(VOICE_PRESETS).map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="config-group ai-toggle">
              <label className="checkbox-label">
                <input 
                  type="checkbox"
                  checked={useAiCommentary}
                  onChange={() => setUseAiCommentary(!useAiCommentary)}
                  disabled={isGenerating}
                />
                <span>AI Commentary</span>
              </label>
            </div>
          </div>

          {/* Custom Voice Input (conditional) */}
          {voice === 'custom' && (
            <div className="config-row">
              <textarea
                className="custom-voice-input"
                value={customVoice}
                onChange={(e) => setCustomVoice(e.target.value.slice(0, 150))}
                placeholder="Describe your custom voice..."
                maxLength={150}
                disabled={isGenerating}
              />
            </div>
          )}

          {/* Row 3: Sections */}
          <div className="config-row sections-row">
            <label className="row-label">Sections</label>
            <div className="sections-grid">
              {sections.map(section => (
                <label key={section.id} className="section-chip">
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
          </div>

          {/* Generate Button */}
          <button 
            className="generate-btn"
            onClick={generateReport}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <span className="spinner" />
                {progress.currentSection}
              </>
            ) : (
              'Generate Report'
            )}
          </button>
        </aside>

        {/* Center: Preview */}
        <main className="preview-panel">
          {progress.status === 'idle' && !reportUrl && (
            <div className="preview-empty">
              <div className="preview-placeholder">
                <div className="ph-line w60" />
                <div className="ph-line w80" />
                <div className="ph-row">
                  <div className="ph-box" />
                  <div className="ph-box" />
                </div>
                <div className="ph-line w100" />
                <div className="ph-line w70" />
              </div>
              <p>Configure and generate report</p>
            </div>
          )}

          {progress.status === 'generating' && (
            <div className="preview-loading">
              <div className="skeleton-preview">
                <div className="sk-line w60" />
                <div className="sk-line w80" />
                <div className="sk-row">
                  <div className="sk-box" />
                  <div className="sk-box" />
                </div>
                <div className="sk-line w100" />
              </div>
              <div className="progress-indicator">
                <span className="spinner" />
                <span>{progress.currentSection}</span>
              </div>
            </div>
          )}

          {progress.status === 'error' && (
            <div className="preview-error">
              <InfoBanner variant="error">
                {error || 'An error occurred.'}
              </InfoBanner>
              <Button onClick={generateReport}>Retry</Button>
            </div>
          )}

          {reportUrl && progress.status === 'complete' && (
            <iframe
              ref={iframeRef}
              src={reportUrl}
              className="preview-frame"
              title="Report Preview"
            />
          )}
        </main>

        {/* Right Panel: Actions & Info */}
        <aside className="actions-panel">
          <div className="panel-section">
            <h3>Export</h3>
            <div className="action-buttons">
              <button className="action-btn primary" onClick={exportPdf} disabled={!reportUrl}>
                Download PDF
              </button>
              <button className="action-btn secondary" onClick={copyHtml} disabled={!reportUrl}>
                Copy HTML
              </button>
              <button className="action-btn tertiary" onClick={downloadHtml} disabled={!reportUrl}>
                Save HTML
              </button>
            </div>
          </div>

          {reportUrl && (
            <div className="panel-section">
              <h3>Details</h3>
              <div className="detail-list">
                <div className="detail-row">
                  <span>Template</span>
                  <span>{selectedTemplate.name}</span>
                </div>
                <div className="detail-row">
                  <span>Voice</span>
                  <span>{selectedVoice.name}</span>
                </div>
                <div className="detail-row">
                  <span>AI</span>
                  <span>{useAiCommentary ? 'On' : 'Off'}</span>
                </div>
                <div className="detail-row">
                  <span>Generated</span>
                  <span>{new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          )}

          <div className="panel-section">
            <h3>Sections</h3>
            <div className="section-list">
              {sections.filter(s => s.enabled).map(s => (
                <span key={s.id} className="section-tag">{s.title}</span>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .reports-page {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 60px);
          overflow: hidden;
        }

        .reports-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        /* Header */
        .reports-header {
          padding: var(--space-sm) var(--space-lg);
          border-bottom: 1px solid var(--border-light);
          background: var(--surface);
        }

        .header-left h1 {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--accent-primary);
          margin: 0;
        }

        .header-meta {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* Main Container */
        .reports-container {
          display: grid;
          grid-template-columns: 1fr 2fr 240px;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        /* Config Panel */
        .config-panel {
          padding: var(--space-md);
          background: var(--surface);
          border-right: 1px solid var(--border-light);
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          overflow-y: auto;
        }

        .config-row {
          display: flex;
          gap: var(--space-sm);
          flex-wrap: wrap;
          align-items: flex-end;
        }

        .config-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 80px;
        }

        .config-group.flex-1 {
          flex: 1;
        }

        .config-group label {
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
        }

        .config-group select {
          padding: 6px 8px;
          font-size: 0.8125rem;
          border: 1px solid var(--border-light);
          background: var(--background);
          color: var(--foreground);
          border-radius: 4px;
        }

        /* Toggle Group */
        .toggle-group {
          display: flex;
        }

        .toggle-btn {
          padding: 6px 10px;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid var(--border-light);
          background: var(--background);
          color: var(--text-muted);
          cursor: pointer;
        }

        .toggle-btn:first-child {
          border-radius: 4px 0 0 4px;
        }

        .toggle-btn:last-child {
          border-radius: 0 4px 4px 0;
          border-left: none;
        }

        .toggle-btn.active {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: white;
        }

        .toggle-btn:disabled {
          opacity: 0.5;
        }

        /* AI Toggle */
        .ai-toggle {
          justify-content: flex-end;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          cursor: pointer;
          white-space: nowrap;
        }

        .checkbox-label input {
          accent-color: var(--accent-primary);
        }

        /* Custom Voice */
        .custom-voice-input {
          width: 100%;
          min-height: 50px;
          padding: 8px;
          font-size: 0.8125rem;
          border: 1px solid var(--border-light);
          background: var(--background);
          border-radius: 4px;
          resize: none;
        }

        /* Sections */
        .sections-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
        }

        .row-label {
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
        }

        .sections-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .section-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          font-size: 0.75rem;
          background: var(--background);
          border: 1px solid var(--border-light);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .section-chip:has(input:checked) {
          background: rgba(45, 80, 22, 0.1);
          border-color: var(--accent-primary);
        }

        .section-chip input {
          display: none;
        }

        /* Generate Button */
        .generate-btn {
          margin-top: auto;
          padding: 12px;
          font-size: 0.8125rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: var(--accent-primary);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .generate-btn:hover:not(:disabled) {
          background: var(--accent-secondary);
        }

        .generate-btn:disabled {
          opacity: 0.6;
        }

        .spinner {
          width: 14px;
          height: 14px;
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
          background: var(--surface-sunken);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-md);
          overflow: hidden;
        }

        .preview-empty,
        .preview-loading,
        .preview-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-md);
        }

        .preview-empty p {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .preview-placeholder,
        .skeleton-preview {
          width: 300px;
          padding: var(--space-lg);
          background: var(--surface);
          border: 2px dashed var(--border-light);
        }

        .skeleton-preview {
          border-style: solid;
        }

        .ph-line, .sk-line {
          height: 12px;
          background: var(--border-light);
          margin-bottom: 10px;
          border-radius: 2px;
        }

        .sk-line {
          animation: pulse 1.5s infinite;
        }

        .w60 { width: 60%; }
        .w70 { width: 70%; }
        .w80 { width: 80%; }
        .w100 { width: 100%; }

        .ph-row, .sk-row {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
        }

        .ph-box, .sk-box {
          flex: 1;
          height: 50px;
          background: var(--border-light);
          border-radius: 4px;
        }

        .sk-box {
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }

        .progress-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.875rem;
          color: var(--accent-primary);
        }

        .preview-frame {
          width: 100%;
          height: 100%;
          border: 1px solid var(--border-light);
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        /* Actions Panel */
        .actions-panel {
          padding: var(--space-md);
          background: var(--surface);
          border-left: 1px solid var(--border-light);
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          overflow-y: auto;
        }

        .panel-section h3 {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          margin: 0 0 8px;
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .action-btn {
          padding: 8px 12px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .action-btn.primary {
          background: var(--accent-primary);
          color: white;
          border: none;
        }

        .action-btn.primary:hover:not(:disabled) {
          background: var(--accent-secondary);
        }

        .action-btn.secondary {
          background: transparent;
          color: var(--accent-primary);
          border: 1px solid var(--accent-primary);
        }

        .action-btn.tertiary {
          background: transparent;
          color: var(--text-muted);
          border: 1px solid var(--border-light);
        }

        .action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .detail-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
        }

        .detail-row span:first-child {
          color: var(--text-muted);
        }

        .detail-row span:last-child {
          font-weight: 500;
        }

        .section-list {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .section-tag {
          padding: 2px 6px;
          font-size: 0.6875rem;
          background: rgba(45, 80, 22, 0.1);
          color: var(--accent-primary);
          border-radius: 3px;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .reports-container {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr auto;
          }

          .config-panel {
            border-right: none;
            border-bottom: 1px solid var(--border-light);
          }

          .actions-panel {
            border-left: none;
            border-top: 1px solid var(--border-light);
            flex-direction: row;
            flex-wrap: wrap;
          }

          .panel-section {
            flex: 1;
            min-width: 150px;
          }

          .preview-panel {
            min-height: 400px;
          }
        }

        @media (max-width: 640px) {
          .config-row {
            flex-direction: column;
            align-items: stretch;
          }

          .config-group {
            width: 100%;
          }

          .toggle-group {
            width: 100%;
          }

          .toggle-btn {
            flex: 1;
          }
        }
      `}</style>
    </div>
  )
}
