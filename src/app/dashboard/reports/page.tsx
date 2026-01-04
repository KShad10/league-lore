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
  wordCount?: number
}

const DEFAULT_SECTIONS: ReportSection[] = [
  { id: 'standings', title: 'Standings', enabled: true },
  { id: 'matchups', title: 'Matchup Recaps', enabled: true },
  { id: 'awards', title: 'Awards', enabled: true },
  { id: 'powerRankings', title: 'Power Rankings', enabled: false },
  { id: 'playoffPicture', title: 'Playoff Picture', enabled: true },
  { id: 'transactions', title: 'Transactions', enabled: false },
  { id: 'injuries', title: 'Injury Report', enabled: false },
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

  // Editing State
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [activePreviewSection, setActivePreviewSection] = useState<string | null>(null)

  // Build week options based on current date
  const getWeekOptions = useCallback(() => {
    const options = []
    // Regular season weeks
    for (let i = 1; i <= 14; i++) {
      options.push({ value: String(i), label: `Week ${i}` })
    }
    // Playoff weeks
    options.push({ value: '15', label: 'Playoffs Round 1' })
    options.push({ value: '16', label: 'Playoffs Round 2' })
    options.push({ value: '17', label: 'Championship Week' })
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
      // Default to most recent week (for now, week 14)
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

  // Convert sections array to config object for API
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
      
      // First check if data exists with GET (fast)
      setProgress({ status: 'generating', currentSection: 'Checking data availability...' })
      const checkUrl = `${baseUrl}?season=${season}${reportType === 'weekly' ? `&week=${week}` : ''}&format=json`
      const checkResponse = await fetch(checkUrl)
      const checkData = await checkResponse.json()

      if (!checkData.success) {
        throw new Error(checkData.error || 'Failed to generate report')
      }

      // Now generate full report with POST (includes AI commentary)
      setProgress({ 
        status: 'generating', 
        currentSection: useAiCommentary ? 'Generating AI commentary...' : 'Building report...'
      })
      
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      // Get the HTML content
      const html = await response.text()
      setReportHtml(html)
      
      // Create a blob URL for the iframe
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
      // Could add toast notification here
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
      a.download = `league-report-${season}-${reportType === 'weekly' ? `week${week}` : 'postseason'}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      setError(`Download failed: ${err}`)
    }
  }

  // Cleanup blob URL on unmount or when report changes
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
    <div className="reports-container">
      {/* Left Panel: Configuration */}
      <aside className="reports-panel left-panel">
        <div className="panel-content">
          {/* Report Scope */}
          <section className="config-section">
            <h3 className="config-title">Report Scope</h3>
            
            <div className="config-field">
              <label>Report Type</label>
              <div className="type-toggle">
                <button 
                  className={`type-btn ${reportType === 'weekly' ? 'active' : ''}`}
                  onClick={() => setReportType('weekly')}
                  disabled={isGenerating}
                >
                  Weekly
                </button>
                <button 
                  className={`type-btn ${reportType === 'postseason' ? 'active' : ''}`}
                  onClick={() => setReportType('postseason')}
                  disabled={isGenerating}
                >
                  Postseason
                </button>
              </div>
            </div>

            <div className="config-field">
              <label>Season</label>
              <select 
                value={season} 
                onChange={(e) => setSeason(e.target.value)}
                disabled={isGenerating}
              >
                {seasonOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {reportType === 'weekly' && (
              <div className="config-field">
                <label>Week</label>
                <select 
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
          </section>

          {/* Template Selection */}
          <section className="config-section">
            <h3 className="config-title">Template</h3>
            <div className="template-cards">
              {Object.values(REPORT_TEMPLATES).map(t => (
                <div 
                  key={t.id}
                  className={`template-card ${template === t.id ? 'selected' : ''}`}
                  onClick={() => !isGenerating && setTemplate(t.id)}
                >
                  <div className="template-name">{t.name}</div>
                  <div className="template-desc">{t.description}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Voice Preset */}
          <section className="config-section">
            <h3 className="config-title">Voice</h3>
            <div className="voice-options">
              {Object.values(VOICE_PRESETS).map(v => (
                <label key={v.id} className={`voice-option ${voice === v.id ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name="voice" 
                    value={v.id}
                    checked={voice === v.id}
                    onChange={() => setVoice(v.id)}
                    disabled={isGenerating}
                  />
                  <span className="voice-name">{v.name}</span>
                  <span className="voice-desc">{v.description}</span>
                </label>
              ))}
            </div>

            {voice === 'custom' && (
              <textarea
                className="custom-voice-input"
                value={customVoice}
                onChange={(e) => setCustomVoice(e.target.value.slice(0, 150))}
                placeholder="Describe your custom voice..."
                maxLength={150}
                disabled={isGenerating}
              />
            )}
            
            {/* AI Commentary Toggle */}
            <label className="ai-toggle">
              <input 
                type="checkbox"
                checked={useAiCommentary}
                onChange={() => setUseAiCommentary(!useAiCommentary)}
                disabled={isGenerating}
              />
              <span>Generate AI commentary</span>
              <span className="ai-toggle-hint">(slower but personalized)</span>
            </label>
          </section>

          {/* Sections Toggle */}
          <section className="config-section">
            <h3 className="config-title">Sections</h3>
            <div className="sections-list">
              {sections.map(section => (
                <label key={section.id} className="section-toggle">
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
          </section>
        </div>

        {/* Generate Button */}
        <div className="panel-footer">
          <button 
            className="generate-btn"
            onClick={generateReport}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <span className="spinner" />
                {progress.currentSection || 'Generating...'}
              </>
            ) : (
              'Generate Report'
            )}
          </button>
        </div>
      </aside>

      {/* Center Panel: Preview */}
      <main className="reports-panel center-panel">
        {progress.status === 'idle' && !reportUrl && (
          <div className="preview-empty">
            <div className="preview-placeholder">
              <div className="placeholder-box header" />
              <div className="placeholder-box title" />
              <div className="placeholder-row">
                <div className="placeholder-box col" />
                <div className="placeholder-box col" />
              </div>
              <div className="placeholder-box content" />
              <div className="placeholder-box content short" />
            </div>
            <p className="preview-hint">Configure settings and generate report</p>
          </div>
        )}

        {progress.status === 'generating' && (
          <div className="preview-loading">
            <div className="skeleton-preview">
              <div className="skeleton header" />
              <div className="skeleton title" />
              <div className="skeleton-row">
                <div className="skeleton col" />
                <div className="skeleton col" />
              </div>
              <div className="skeleton content" />
              <div className="skeleton content" />
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
              {error || 'An error occurred while generating the report.'}
            </InfoBanner>
            <Button onClick={generateReport}>Retry</Button>
          </div>
        )}

        {reportUrl && progress.status === 'complete' && (
          <div className="preview-frame-container">
            <iframe
              ref={iframeRef}
              src={reportUrl}
              className="preview-frame"
              title="Report Preview"
            />
          </div>
        )}
      </main>

      {/* Right Panel: Navigator + Actions */}
      <aside className="reports-panel right-panel">
        <div className="panel-content">
          {/* Section Navigator */}
          <section className="nav-section">
            <h3 className="nav-title">Sections</h3>
            {reportUrl ? (
              <div className="section-nav-list">
                {sections.filter(s => s.enabled).map(section => (
                  <button 
                    key={section.id}
                    className={`section-nav-item ${activePreviewSection === section.id ? 'active' : ''}`}
                    onClick={() => setActivePreviewSection(section.id)}
                  >
                    <span className="section-nav-name">{section.title}</span>
                    {section.wordCount && (
                      <span className="section-nav-count">{section.wordCount} words</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="nav-empty">Generate a report to navigate sections</p>
            )}
          </section>

          {/* Metadata */}
          {reportUrl && (
            <section className="metadata-section">
              <h3 className="nav-title">Details</h3>
              <div className="metadata-list">
                <div className="metadata-item">
                  <span className="metadata-label">Template</span>
                  <span className="metadata-value">{selectedTemplate.name}</span>
                </div>
                <div className="metadata-item">
                  <span className="metadata-label">Voice</span>
                  <span className="metadata-value">{selectedVoice.name}</span>
                </div>
                <div className="metadata-item">
                  <span className="metadata-label">AI Commentary</span>
                  <span className="metadata-value">{useAiCommentary ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="metadata-item">
                  <span className="metadata-label">Generated</span>
                  <span className="metadata-value">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Export Actions */}
        <div className="panel-footer">
          <button 
            className="export-btn primary"
            onClick={exportPdf}
            disabled={!reportUrl}
          >
            Download PDF
          </button>
          <button 
            className="export-btn secondary"
            onClick={copyHtml}
            disabled={!reportUrl}
          >
            Copy HTML
          </button>
          <button 
            className="export-btn tertiary"
            onClick={downloadHtml}
            disabled={!reportUrl}
          >
            Save HTML
          </button>
        </div>
      </aside>

      <style jsx>{`
        .reports-container {
          display: grid;
          grid-template-columns: 280px 1fr 320px;
          min-height: calc(100vh - 140px);
          gap: 0;
        }

        .reports-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }

        .reports-panel {
          display: flex;
          flex-direction: column;
          background: var(--surface);
          border-right: 1px solid var(--border-light);
        }

        .reports-panel:last-child {
          border-right: none;
          border-left: 1px solid var(--border-light);
        }

        .center-panel {
          background: var(--surface-sunken);
          border: none;
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-lg);
        }

        .panel-footer {
          padding: var(--space-md);
          border-top: 1px solid var(--border-light);
          background: var(--surface);
        }

        /* Config Section Styles */
        .config-section {
          margin-bottom: var(--space-xl);
        }

        .config-title {
          font-family: var(--font-sans);
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          margin: 0 0 var(--space-sm);
        }

        .config-field {
          margin-bottom: var(--space-md);
        }

        .config-field label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--foreground);
          margin-bottom: var(--space-xs);
        }

        .config-field select {
          width: 100%;
          padding: var(--space-sm);
          font-size: 0.875rem;
          border: 1px solid var(--border-light);
          background: var(--background);
          color: var(--foreground);
        }

        .type-toggle {
          display: flex;
          gap: 0;
        }

        .type-btn {
          flex: 1;
          padding: var(--space-sm);
          font-size: 0.8125rem;
          font-weight: 600;
          border: 1px solid var(--border-light);
          background: var(--background);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .type-btn:first-child {
          border-radius: 4px 0 0 4px;
        }

        .type-btn:last-child {
          border-radius: 0 4px 4px 0;
          border-left: none;
        }

        .type-btn.active {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: white;
        }

        .type-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Template Cards */
        .template-cards {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .template-card {
          padding: var(--space-md);
          border: 2px solid var(--border-light);
          background: var(--background);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .template-card:hover {
          border-color: var(--accent-primary);
        }

        .template-card.selected {
          border-color: var(--accent-primary);
          background: rgba(45, 80, 22, 0.05);
        }

        .template-name {
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--foreground);
          margin-bottom: 2px;
        }

        .template-desc {
          font-size: 0.75rem;
          color: var(--text-muted);
          line-height: 1.4;
        }

        /* Voice Options */
        .voice-options {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }

        .voice-option {
          display: flex;
          flex-direction: column;
          padding: var(--space-sm);
          border: 1px solid var(--border-light);
          background: var(--background);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .voice-option:hover {
          border-color: var(--accent-primary);
        }

        .voice-option.selected {
          border-color: var(--accent-primary);
          background: rgba(45, 80, 22, 0.05);
        }

        .voice-option input {
          display: none;
        }

        .voice-name {
          font-weight: 600;
          font-size: 0.8125rem;
          color: var(--foreground);
        }

        .voice-desc {
          font-size: 0.6875rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .custom-voice-input {
          width: 100%;
          min-height: 60px;
          padding: var(--space-sm);
          margin-top: var(--space-sm);
          font-size: 0.8125rem;
          border: 1px solid var(--border-light);
          background: var(--background);
          color: var(--foreground);
          resize: vertical;
        }

        /* AI Toggle */
        .ai-toggle {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-sm) 0;
          margin-top: var(--space-md);
          font-size: 0.8125rem;
          cursor: pointer;
          border-top: 1px solid var(--border-light);
          padding-top: var(--space-md);
        }

        .ai-toggle input {
          accent-color: var(--accent-primary);
        }
        
        .ai-toggle-hint {
          font-size: 0.6875rem;
          color: var(--text-muted);
          margin-left: auto;
        }

        /* Sections Toggle */
        .sections-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }

        .section-toggle {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-xs) 0;
          font-size: 0.8125rem;
          cursor: pointer;
        }

        .section-toggle input {
          accent-color: var(--accent-primary);
        }

        /* Generate Button */
        .generate-btn {
          width: 100%;
          padding: var(--space-md);
          font-size: 0.875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: var(--accent-primary);
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-sm);
          transition: background 0.15s ease;
        }

        .generate-btn:hover:not(:disabled) {
          background: var(--accent-secondary);
        }

        .generate-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Preview States */
        .preview-empty,
        .preview-loading,
        .preview-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: var(--space-2xl);
        }

        .preview-placeholder,
        .skeleton-preview {
          width: 100%;
          max-width: 400px;
          padding: var(--space-xl);
          border: 2px dashed var(--border-light);
          background: var(--surface);
        }

        .skeleton-preview {
          border-style: solid;
        }

        .placeholder-box,
        .skeleton {
          background: var(--border-light);
          margin-bottom: var(--space-md);
        }

        .placeholder-box.header,
        .skeleton.header {
          height: 40px;
          width: 60%;
        }

        .placeholder-box.title,
        .skeleton.title {
          height: 24px;
          width: 80%;
        }

        .placeholder-row,
        .skeleton-row {
          display: flex;
          gap: var(--space-md);
          margin-bottom: var(--space-md);
        }

        .placeholder-box.col,
        .skeleton.col {
          flex: 1;
          height: 60px;
          margin-bottom: 0;
        }

        .placeholder-box.content,
        .skeleton.content {
          height: 20px;
          width: 100%;
        }

        .placeholder-box.short {
          width: 70%;
        }

        .skeleton {
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }

        .preview-hint {
          margin-top: var(--space-lg);
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .progress-indicator {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          margin-top: var(--space-lg);
          font-size: 0.875rem;
          color: var(--accent-primary);
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid var(--border-light);
          border-top-color: var(--accent-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Preview Frame */
        .preview-frame-container {
          height: 100%;
          padding: var(--space-lg);
        }

        .preview-frame {
          width: 100%;
          height: 100%;
          border: 1px solid var(--border-light);
          background: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        /* Right Panel */
        .nav-section,
        .metadata-section {
          margin-bottom: var(--space-xl);
        }

        .nav-title {
          font-family: var(--font-sans);
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          margin: 0 0 var(--space-sm);
        }

        .nav-empty {
          font-size: 0.8125rem;
          color: var(--text-muted);
          font-style: italic;
        }

        .section-nav-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .section-nav-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-sm);
          background: transparent;
          border: none;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .section-nav-item:hover {
          background: var(--surface-sunken);
        }

        .section-nav-item.active {
          background: rgba(45, 80, 22, 0.1);
          border-left: 3px solid var(--accent-primary);
        }

        .section-nav-name {
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--foreground);
        }

        .section-nav-count {
          font-size: 0.6875rem;
          color: var(--text-muted);
        }

        /* Metadata */
        .metadata-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .metadata-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.8125rem;
        }

        .metadata-label {
          color: var(--text-muted);
        }

        .metadata-value {
          font-weight: 500;
          color: var(--foreground);
        }

        /* Export Buttons */
        .right-panel .panel-footer {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .export-btn {
          width: 100%;
          padding: var(--space-sm) var(--space-md);
          font-size: 0.8125rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .export-btn.primary {
          background: var(--accent-primary);
          color: white;
          border: 2px solid var(--accent-primary);
        }

        .export-btn.primary:hover:not(:disabled) {
          background: var(--accent-secondary);
          border-color: var(--accent-secondary);
        }

        .export-btn.secondary {
          background: transparent;
          color: var(--accent-primary);
          border: 2px solid var(--accent-primary);
        }

        .export-btn.secondary:hover:not(:disabled) {
          background: rgba(45, 80, 22, 0.05);
        }

        .export-btn.tertiary {
          background: transparent;
          color: var(--text-muted);
          border: 2px solid var(--border-light);
        }

        .export-btn.tertiary:hover:not(:disabled) {
          color: var(--foreground);
          border-color: var(--foreground);
        }

        .export-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Mobile Responsive */
        @media (max-width: 1024px) {
          .reports-container {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr auto;
          }

          .reports-panel {
            border-right: none;
            border-bottom: 1px solid var(--border-light);
          }

          .reports-panel:last-child {
            border-left: none;
            border-top: 1px solid var(--border-light);
          }

          .left-panel .panel-content {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: var(--space-lg);
          }

          .left-panel .config-section {
            margin-bottom: 0;
          }

          .center-panel {
            min-height: 500px;
          }
        }

        @media (max-width: 640px) {
          .left-panel .panel-content {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
