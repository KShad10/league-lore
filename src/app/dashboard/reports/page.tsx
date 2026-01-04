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
  const [showExport, setShowExport] = useState(false)

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
    
    setShowConfig(false) // Close config on mobile
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
    setShowExport(false)
  }

  const copyHtml = async () => {
    if (!reportHtml) return
    await navigator.clipboard.writeText(reportHtml)
    setShowExport(false)
  }

  const downloadHtml = () => {
    if (!reportHtml) return
    const blob = new Blob([reportHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${season}-week${week}.html`
    a.click()
    URL.revokeObjectURL(url)
    setShowExport(false)
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
      {/* Action Bar */}
      <div className="action-bar">
        <div className="context">
          <span className="context-label">{season}</span>
          {reportType === 'weekly' && <span className="context-label">• Wk {week}</span>}
        </div>
        <div className="actions">
          <button 
            className="btn-config-toggle"
            onClick={() => setShowConfig(!showConfig)}
            aria-label="Toggle configuration"
          >
            ⚙️
          </button>
          <button 
            className="btn-generate"
            onClick={generateReport}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <span className="spinner" />
                <span className="btn-text">Generating...</span>
              </>
            ) : (
              <span className="btn-text">Generate</span>
            )}
          </button>
          {hasReport && (
            <div className="export-dropdown">
              <button 
                className="btn-export"
                onClick={() => setShowExport(!showExport)}
              >
                Export
              </button>
              {showExport && (
                <div className="dropdown-menu">
                  <button onClick={exportPdf}>Download PDF</button>
                  <button onClick={copyHtml}>Copy HTML</button>
                  <button onClick={downloadHtml}>Save HTML</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className="main-layout">
        {/* Left: Configuration */}
        <aside className={`config-panel ${isGenerating ? 'disabled' : ''} ${showConfig ? 'mobile-open' : ''}`}>
          <div className="config-header-mobile">
            <span>Configuration</span>
            <button onClick={() => setShowConfig(false)} className="close-btn">✕</button>
          </div>
          
          <div className="config-scroll">
            <div className="config-group">
              <label>Report Type</label>
              <div className="radio-group">
                <label className={`radio-option ${reportType === 'weekly' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    checked={reportType === 'weekly'} 
                    onChange={() => setReportType('weekly')}
                    disabled={isGenerating}
                  />
                  <span>Weekly</span>
                </label>
                <label className={`radio-option ${reportType === 'postseason' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    checked={reportType === 'postseason'} 
                    onChange={() => setReportType('postseason')}
                    disabled={isGenerating}
                  />
                  <span>Postseason</span>
                </label>
              </div>
            </div>

            <div className="config-row-inline">
              {reportType === 'weekly' && (
                <div className="config-group flex-1">
                  <label>Week</label>
                  <select value={week} onChange={(e) => setWeek(e.target.value)} disabled={isGenerating}>
                    {weekOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="config-group flex-1">
                <label>Season</label>
                <select value={season} onChange={(e) => setSeason(e.target.value)} disabled={isGenerating}>
                  {seasonOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="config-row-inline">
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
            </div>

            {voice === 'custom' && (
              <div className="config-group">
                <textarea
                  value={customVoice}
                  onChange={(e) => setCustomVoice(e.target.value.slice(0, 150))}
                  placeholder="Describe your custom voice..."
                  maxLength={150}
                  disabled={isGenerating}
                />
              </div>
            )}

            <div className="config-group">
              <label className="checkbox-inline">
                <input 
                  type="checkbox"
                  checked={useAiCommentary}
                  onChange={() => setUseAiCommentary(!useAiCommentary)}
                  disabled={isGenerating}
                />
                <span>AI Commentary</span>
              </label>
            </div>

            <div className="config-group">
              <label>Include Sections</label>
              <div className="section-grid">
                {sections.map(section => (
                  <label key={section.id} className="checkbox-chip">
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
          </div>
          
          <div className="config-footer-mobile">
            <button className="btn-generate-mobile" onClick={generateReport} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </aside>

        {/* Center: Preview */}
        <main className="preview-panel">
          {progress.status === 'idle' && !reportUrl && (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <h3>Ready to Generate</h3>
              <p>Configure settings and tap Generate</p>
              <button className="btn-generate-cta" onClick={() => setShowConfig(true)}>
                <span className="mobile-only">Configure Report</span>
                <span className="desktop-only">Generate Report</span>
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
              </div>
              <div className="progress-text">
                <span className="spinner" />
                {progress.currentSection}
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
            <iframe
              ref={iframeRef}
              src={reportUrl}
              className="report-frame"
              title="Report Preview"
            />
          )}
        </main>

        {/* Right: Navigate (desktop only) */}
        <aside className="navigate-panel">
          <div className="panel-section">
            <h4>Navigate</h4>
            {hasReport ? (
              <div className="nav-links">
                {sections.filter(s => s.enabled).map(s => (
                  <button key={s.id} className="nav-link">{s.title}</button>
                ))}
              </div>
            ) : (
              <p className="nav-empty">Generate a report to navigate sections</p>
            )}
          </div>

          {hasReport && (
            <div className="panel-section">
              <h4>Details</h4>
              <div className="detail-grid">
                <span>Template</span><span>{REPORT_TEMPLATES[template].name}</span>
                <span>Voice</span><span>{VOICE_PRESETS[voice].name}</span>
                <span>AI</span><span>{useAiCommentary ? 'Enabled' : 'Off'}</span>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile overlay backdrop */}
      {showConfig && <div className="mobile-backdrop" onClick={() => setShowConfig(false)} />}

      <style jsx>{`
        .reports-page {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 120px);
          overflow: hidden;
        }

        .loading-container {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        /* Action Bar */
        .action-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          background: var(--surface);
          border-bottom: 1px solid var(--border-light);
        }

        .context {
          display: flex;
          gap: 8px;
        }

        .context-label {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .btn-config-toggle {
          display: none;
          width: 40px;
          height: 40px;
          font-size: 1.25rem;
          background: var(--surface-sunken);
          border: 1px solid var(--border-light);
          border-radius: 6px;
          cursor: pointer;
        }

        .btn-generate {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          font-size: 0.875rem;
          font-weight: 600;
          background: var(--accent-primary);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .btn-generate:hover:not(:disabled) {
          background: var(--accent-secondary);
        }

        .btn-generate:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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

        .export-dropdown {
          position: relative;
        }

        .btn-export {
          padding: 10px 16px;
          font-size: 0.875rem;
          font-weight: 500;
          background: white;
          border: 1px solid var(--border-light);
          border-radius: 6px;
          cursor: pointer;
        }

        .dropdown-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          background: white;
          border: 1px solid var(--border-light);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 100;
          min-width: 140px;
        }

        .dropdown-menu button {
          display: block;
          width: 100%;
          padding: 12px 14px;
          font-size: 0.875rem;
          text-align: left;
          background: none;
          border: none;
          cursor: pointer;
        }

        .dropdown-menu button:hover {
          background: var(--surface-sunken);
        }

        /* Main Layout */
        .main-layout {
          display: grid;
          grid-template-columns: 220px 1fr 180px;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        /* Config Panel */
        .config-panel {
          padding: 16px;
          background: var(--surface);
          border-right: 1px solid var(--border-light);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .config-panel.disabled {
          opacity: 0.5;
          pointer-events: none;
        }

        .config-header-mobile,
        .config-footer-mobile {
          display: none;
        }

        .config-scroll {
          display: contents;
        }

        .config-row-inline {
          display: flex;
          gap: 12px;
        }

        .config-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .config-group.flex-1 {
          flex: 1;
        }

        .config-group > label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .config-group select,
        .config-group textarea {
          width: 100%;
          padding: 8px 10px;
          font-size: 0.875rem;
          border: 1px solid var(--border-light);
          border-radius: 4px;
          background: white;
        }

        .config-group textarea {
          min-height: 60px;
          resize: none;
        }

        .radio-group {
          display: flex;
          gap: 0;
        }

        .radio-option {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          font-size: 0.8125rem;
          font-weight: 500;
          border: 1px solid var(--border-light);
          background: white;
          cursor: pointer;
          transition: all 0.15s;
        }

        .radio-option:first-child {
          border-radius: 4px 0 0 4px;
        }

        .radio-option:last-child {
          border-radius: 0 4px 4px 0;
          border-left: none;
        }

        .radio-option.selected {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: white;
        }

        .radio-option input {
          display: none;
        }

        .checkbox-inline {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8125rem;
          cursor: pointer;
        }

        .checkbox-inline input {
          accent-color: var(--accent-primary);
          width: 16px;
          height: 16px;
        }

        .section-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .checkbox-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          font-size: 0.75rem;
          background: white;
          border: 1px solid var(--border-light);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .checkbox-chip:has(input:checked) {
          background: rgba(45, 80, 22, 0.1);
          border-color: var(--accent-primary);
        }

        .checkbox-chip input {
          display: none;
        }

        /* Preview Panel */
        .preview-panel {
          background: var(--surface-sunken);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 16px;
        }

        .empty-state,
        .loading-state,
        .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
          padding: 20px;
        }

        .empty-icon {
          font-size: 3rem;
          opacity: 0.5;
        }

        .empty-state h3 {
          margin: 0;
          font-size: 1.125rem;
          color: var(--foreground);
        }

        .empty-state p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .btn-generate-cta {
          margin-top: 8px;
          padding: 12px 24px;
          font-size: 0.875rem;
          font-weight: 600;
          background: var(--accent-primary);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .btn-generate-cta:hover {
          background: var(--accent-secondary);
        }

        .mobile-only {
          display: none;
        }

        .skeleton {
          width: 280px;
          max-width: 100%;
          padding: 20px;
          background: var(--surface);
          border: 1px solid var(--border-light);
          border-radius: 8px;
        }

        .sk-header {
          width: 50%;
          height: 20px;
          background: var(--border-light);
          margin-bottom: 8px;
          animation: pulse 1.5s infinite;
        }

        .sk-subheader {
          width: 70%;
          height: 14px;
          background: var(--border-light);
          margin-bottom: 16px;
          animation: pulse 1.5s infinite;
        }

        .sk-row {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }

        .sk-box {
          flex: 1;
          height: 60px;
          background: var(--border-light);
          border-radius: 4px;
          animation: pulse 1.5s infinite;
        }

        .sk-line {
          width: 100%;
          height: 12px;
          background: var(--border-light);
          margin-bottom: 8px;
          animation: pulse 1.5s infinite;
        }

        .sk-line.short {
          width: 60%;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }

        .progress-text {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.875rem;
          color: var(--accent-primary);
        }

        .progress-text .spinner {
          border-color: var(--border-light);
          border-top-color: var(--accent-primary);
        }

        .report-frame {
          width: 100%;
          height: 100%;
          border: 1px solid var(--border-light);
          background: white;
          border-radius: 4px;
        }

        /* Navigate Panel */
        .navigate-panel {
          padding: 16px;
          background: var(--surface);
          border-left: 1px solid var(--border-light);
          overflow-y: auto;
        }

        .panel-section {
          margin-bottom: 20px;
        }

        .panel-section h4 {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
          margin: 0 0 10px;
        }

        .nav-links {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nav-link {
          padding: 8px 10px;
          font-size: 0.8125rem;
          text-align: left;
          background: none;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .nav-link:hover {
          background: var(--surface-sunken);
        }

        .nav-empty {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-style: italic;
          margin: 0;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 4px 10px;
          font-size: 0.75rem;
        }

        .detail-grid span:nth-child(odd) {
          color: var(--text-muted);
        }

        .detail-grid span:nth-child(even) {
          font-weight: 500;
        }

        .mobile-backdrop {
          display: none;
        }

        /* ═══════════════════════════════════════════════════════════════
           TABLET BREAKPOINT (900px)
           ═══════════════════════════════════════════════════════════════ */
        @media (max-width: 900px) {
          .main-layout {
            grid-template-columns: 200px 1fr;
          }

          .navigate-panel {
            display: none;
          }

          .preview-panel {
            min-height: 300px;
          }
        }

        /* ═══════════════════════════════════════════════════════════════
           MOBILE BREAKPOINT (640px)
           ═══════════════════════════════════════════════════════════════ */
        @media (max-width: 640px) {
          .reports-page {
            height: calc(100vh - 60px);
          }

          /* Action Bar Mobile */
          .action-bar {
            padding: 10px 12px;
          }

          .context-label {
            font-size: 0.8125rem;
          }

          .btn-config-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .btn-generate {
            padding: 10px 14px;
          }

          .btn-text {
            display: none;
          }

          .btn-generate::after {
            content: '▶';
            font-size: 0.75rem;
          }

          .btn-generate:disabled::after {
            content: '';
          }

          .btn-export {
            padding: 10px 12px;
            font-size: 0.8125rem;
          }

          .dropdown-menu {
            right: -12px;
          }

          /* Main Layout Mobile */
          .main-layout {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr;
          }

          /* Config Panel - Slide-up Sheet */
          .config-panel {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            top: auto;
            height: auto;
            max-height: 85vh;
            border-right: none;
            border-top: 1px solid var(--border-light);
            border-radius: 16px 16px 0 0;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
            transform: translateY(100%);
            transition: transform 0.3s ease;
            z-index: 200;
            gap: 12px;
            padding: 0;
          }

          .config-panel.mobile-open {
            transform: translateY(0);
          }

          .config-header-mobile {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            border-bottom: 1px solid var(--border-light);
            font-weight: 600;
            font-size: 1rem;
          }

          .close-btn {
            width: 32px;
            height: 32px;
            font-size: 1.25rem;
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
          }

          .config-scroll {
            display: flex;
            flex-direction: column;
            gap: 16px;
            padding: 16px;
            overflow-y: auto;
            max-height: calc(85vh - 140px);
          }

          .config-footer-mobile {
            display: block;
            padding: 12px 16px;
            border-top: 1px solid var(--border-light);
            background: var(--surface);
          }

          .btn-generate-mobile {
            width: 100%;
            padding: 14px;
            font-size: 1rem;
            font-weight: 600;
            background: var(--accent-primary);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
          }

          .btn-generate-mobile:disabled {
            opacity: 0.6;
          }

          /* Mobile Backdrop */
          .mobile-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.4);
            z-index: 150;
          }

          /* Preview Panel Mobile */
          .preview-panel {
            padding: 12px;
          }

          .empty-state h3 {
            font-size: 1rem;
          }

          .empty-state p {
            font-size: 0.8125rem;
          }

          .empty-icon {
            font-size: 2.5rem;
          }

          .mobile-only {
            display: inline;
          }

          .desktop-only {
            display: none;
          }

          .btn-generate-cta {
            padding: 14px 24px;
          }

          .skeleton {
            width: 100%;
            padding: 16px;
          }

          /* Sections as chips on mobile */
          .section-grid {
            gap: 8px;
          }

          .checkbox-chip {
            padding: 8px 12px;
            font-size: 0.8125rem;
          }

          /* Inline rows stack on mobile */
          .config-row-inline {
            flex-direction: column;
            gap: 12px;
          }

          .config-group select {
            padding: 12px;
            font-size: 1rem;
          }

          .radio-option {
            padding: 12px;
            font-size: 0.875rem;
          }

          .checkbox-inline {
            font-size: 0.875rem;
            padding: 8px 0;
          }

          .checkbox-inline input {
            width: 20px;
            height: 20px;
          }
        }

        /* ═══════════════════════════════════════════════════════════════
           SMALL MOBILE (380px)
           ═══════════════════════════════════════════════════════════════ */
        @media (max-width: 380px) {
          .action-bar {
            padding: 8px 10px;
          }

          .context-label {
            font-size: 0.75rem;
          }

          .actions {
            gap: 6px;
          }

          .btn-generate {
            padding: 8px 12px;
          }

          .btn-config-toggle {
            width: 36px;
            height: 36px;
          }
        }
      `}</style>
    </div>
  )
}
