'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  NavigationTabs,
  ControlField,
  Select,
  Button,
  InfoBanner,
  LoadingIndicator,
  PageHeader,
  SectionHeader,
  Card,
} from '@/components/ui';
import {
  VoicePreset,
  ReportTemplate,
  VOICE_PRESETS,
  REPORT_TEMPLATES,
} from '@/lib/ai/prompts';
import { printIframe } from '@/lib/pdf';

const LEAGUE_ID = '31da3d9c-39b9-4acf-991c-0accdbdffb64';

type ReportType = 'weekly' | 'postseason';
type TabType = 'reports' | 'commentary';

interface WeeklyCommentary {
  opener: string;
  matchupCommentaries: Record<string, string>;
  standingsAnalysis: string;
  topPerformerSpotlight: string;
  bottomPerformerRoast: string;
  playoffPicture?: string;
  closer: string;
}

interface PostseasonCommentary {
  recap: string;
  championPath: string;
  toiletBowlSummary: string;
}

type WeeklySection = 'opener' | 'standingsAnalysis' | 'topPerformerSpotlight' | 'bottomPerformerRoast' | 'playoffPicture' | 'closer';
type PostseasonSection = 'recap' | 'championPath' | 'toiletBowlSummary';

const TABS = [
  { key: 'reports', label: 'HTML Reports' },
  { key: 'commentary', label: 'AI Commentary' },
];

const SEASON_OPTIONS = [
  { value: '2025', label: '2025' },
  { value: '2024', label: '2024' },
  { value: '2023', label: '2023' },
  { value: '2022', label: '2022' },
];

const WEEK_OPTIONS = Array.from({ length: 17 }, (_, i) => ({
  value: String(i + 1),
  label: `Week ${i + 1}`,
}));

const VOICE_OPTIONS = Object.values(VOICE_PRESETS).map((v) => ({
  value: v.id,
  label: v.name,
}));

const TEMPLATE_OPTIONS = Object.values(REPORT_TEMPLATES).map((t) => ({
  value: t.id,
  label: t.name,
}));

// Draft storage key
const getDraftKey = (type: ReportType, season: string, week?: string) =>
  `league-lore-draft-${type}-${season}${week ? `-w${week}` : ''}`;

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('reports');
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [season, setSeason] = useState('2025');
  const [week, setWeek] = useState('14');
  const [loading, setLoading] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Template & Voice state
  const [voice, setVoice] = useState<VoicePreset>('supreme_leader');
  const [template, setTemplate] = useState<ReportTemplate>('standard');
  const [customVoice, setCustomVoice] = useState('');

  // AI Commentary state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [weeklyCommentary, setWeeklyCommentary] = useState<WeeklyCommentary | null>(null);
  const [postseasonCommentary, setPostseasonCommentary] = useState<PostseasonCommentary | null>(null);

  // Editing state
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // PDF export
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const selectedVoice = VOICE_PRESETS[voice];
  const selectedTemplate = REPORT_TEMPLATES[template];

  // Load draft from localStorage
  useEffect(() => {
    const draftKey = getDraftKey(reportType, season, reportType === 'weekly' ? week : undefined);
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (reportType === 'weekly' && draft.weeklyCommentary) {
          setWeeklyCommentary(draft.weeklyCommentary);
          setLastSaved(new Date(draft.savedAt));
        } else if (reportType === 'postseason' && draft.postseasonCommentary) {
          setPostseasonCommentary(draft.postseasonCommentary);
          setLastSaved(new Date(draft.savedAt));
        }
      } catch {
        // Invalid draft, ignore
      }
    }
  }, [reportType, season, week]);

  // Save draft to localStorage
  const saveDraft = useCallback(() => {
    const draftKey = getDraftKey(reportType, season, reportType === 'weekly' ? week : undefined);
    const draft = {
      savedAt: new Date().toISOString(),
      voice,
      template,
      weeklyCommentary: reportType === 'weekly' ? weeklyCommentary : null,
      postseasonCommentary: reportType === 'postseason' ? postseasonCommentary : null,
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
    setLastSaved(new Date());
    setHasUnsavedChanges(false);
  }, [reportType, season, week, voice, template, weeklyCommentary, postseasonCommentary]);

  // Clear draft
  const clearDraft = () => {
    const draftKey = getDraftKey(reportType, season, reportType === 'weekly' ? week : undefined);
    localStorage.removeItem(draftKey);
    setWeeklyCommentary(null);
    setPostseasonCommentary(null);
    setLastSaved(null);
    setHasUnsavedChanges(false);
  };

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    setReportUrl(null);

    try {
      let url = `/api/leagues/${LEAGUE_ID}/reports/${reportType}?season=${season}`;
      if (reportType === 'weekly') {
        url += `&week=${week}`;
      }

      const checkResponse = await fetch(`${url}&format=json`);
      const checkData = await checkResponse.json();

      if (!checkData.success) {
        throw new Error(checkData.error || 'Failed to generate report');
      }

      setReportUrl(url);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const generateAICommentary = async () => {
    setAiLoading(true);
    setAiError(null);
    setWeeklyCommentary(null);
    setPostseasonCommentary(null);

    try {
      const response = await fetch(`/api/leagues/${LEAGUE_ID}/commentary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: reportType,
          season: parseInt(season),
          week: reportType === 'weekly' ? parseInt(week) : undefined,
          voice,
          template,
          customVoice: voice === 'custom' ? customVoice : undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate commentary');
      }

      if (reportType === 'weekly') {
        setWeeklyCommentary(data.commentary);
      } else {
        setPostseasonCommentary(data.commentary);
      }
      setHasUnsavedChanges(true);
    } catch (err) {
      setAiError(String(err));
    } finally {
      setAiLoading(false);
    }
  };

  // Regenerate a single section
  const regenerateSection = async (sectionKey: string, sectionTitle: string) => {
    setRegeneratingSection(sectionKey);

    try {
      const response = await fetch(`/api/leagues/${LEAGUE_ID}/commentary/section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: reportType,
          season: parseInt(season),
          week: reportType === 'weekly' ? parseInt(week) : undefined,
          voice,
          template,
          customVoice: voice === 'custom' ? customVoice : undefined,
          section: sectionKey,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to regenerate section');
      }

      // Update the specific section
      if (reportType === 'weekly' && weeklyCommentary) {
        setWeeklyCommentary({
          ...weeklyCommentary,
          [sectionKey]: data.content,
        });
      } else if (reportType === 'postseason' && postseasonCommentary) {
        setPostseasonCommentary({
          ...postseasonCommentary,
          [sectionKey]: data.content,
        });
      }
      setHasUnsavedChanges(true);
    } catch (err) {
      setAiError(`Failed to regenerate ${sectionTitle}: ${err}`);
    } finally {
      setRegeneratingSection(null);
    }
  };

  // Update section content (for editing)
  const updateSectionContent = (sectionKey: string, content: string) => {
    if (reportType === 'weekly' && weeklyCommentary) {
      setWeeklyCommentary({
        ...weeklyCommentary,
        [sectionKey]: content,
      });
    } else if (reportType === 'postseason' && postseasonCommentary) {
      setPostseasonCommentary({
        ...postseasonCommentary,
        [sectionKey]: content,
      });
    }
    setHasUnsavedChanges(true);
  };

  // Update matchup commentary
  const updateMatchupCommentary = (matchupKey: string, content: string) => {
    if (weeklyCommentary) {
      setWeeklyCommentary({
        ...weeklyCommentary,
        matchupCommentaries: {
          ...weeklyCommentary.matchupCommentaries,
          [matchupKey]: content,
        },
      });
      setHasUnsavedChanges(true);
    }
  };

  const openInNewTab = () => {
    if (reportUrl) {
      window.open(reportUrl, '_blank');
    }
  };

  const downloadReport = async () => {
    if (!reportUrl) return;

    try {
      const response = await fetch(reportUrl);
      const html = await response.text();

      const blob = new Blob([html], { type: 'text/html' });
      const downloadUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `league-report-${season}-${reportType === 'weekly' ? `week${week}` : 'postseason'}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(`Download failed: ${err}`);
    }
  };

  const exportPdf = () => {
    if (iframeRef.current) {
      printIframe(iframeRef.current);
    }
  };

  const copyCommentaryToClipboard = () => {
    const commentary = reportType === 'weekly' ? weeklyCommentary : postseasonCommentary;
    if (!commentary) return;

    let text = '';
    if (reportType === 'weekly' && weeklyCommentary) {
      text = `OPENER:\n${weeklyCommentary.opener}\n\n`;
      text += `STANDINGS ANALYSIS:\n${weeklyCommentary.standingsAnalysis}\n\n`;
      text += `TOP PERFORMER:\n${weeklyCommentary.topPerformerSpotlight}\n\n`;
      text += `BOTTOM PERFORMER:\n${weeklyCommentary.bottomPerformerRoast}\n\n`;
      if (weeklyCommentary.playoffPicture) {
        text += `PLAYOFF PICTURE:\n${weeklyCommentary.playoffPicture}\n\n`;
      }
      text += `MATCHUP COMMENTARIES:\n`;
      Object.entries(weeklyCommentary.matchupCommentaries).forEach(([matchup, comment]) => {
        text += `\n${matchup}:\n${comment}\n`;
      });
      text += `\nCLOSER:\n${weeklyCommentary.closer}`;
    } else if (postseasonCommentary) {
      text = `RECAP:\n${postseasonCommentary.recap}\n\n`;
      text += `CHAMPION'S PATH:\n${postseasonCommentary.championPath}\n\n`;
      text += `TOILET BOWL:\n${postseasonCommentary.toiletBowlSummary}`;
    }

    navigator.clipboard.writeText(text);
  };

  const hasCommentary = reportType === 'weekly' ? !!weeklyCommentary : !!postseasonCommentary;

  return (
    <div className="page-container">
      <PageHeader title="Report Generator" subtitle="League Lore" />

      <NavigationTabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as TabType)}
      />

      {/* Report Type Selection */}
      <div className="section-block">
        <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
          <button
            onClick={() => setReportType('weekly')}
            className={`btn ${reportType === 'weekly' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Weekly Recap
          </button>
          <button
            onClick={() => setReportType('postseason')}
            className={`btn ${reportType === 'postseason' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Postseason Report
          </button>
        </div>

        {/* Controls */}
        <div className="controls-group">
          <ControlField label="Season">
            <Select value={season} onChange={setSeason} options={SEASON_OPTIONS} />
          </ControlField>

          {reportType === 'weekly' && (
            <ControlField label="Week">
              <Select value={week} onChange={setWeek} options={WEEK_OPTIONS} />
            </ControlField>
          )}

          {activeTab === 'commentary' && (
            <>
              <ControlField label="Template">
                <Select
                  value={template}
                  onChange={(v) => setTemplate(v as ReportTemplate)}
                  options={TEMPLATE_OPTIONS}
                />
              </ControlField>

              <ControlField label="Voice">
                <Select
                  value={voice}
                  onChange={(v) => setVoice(v as VoicePreset)}
                  options={VOICE_OPTIONS}
                />
              </ControlField>
            </>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            {activeTab === 'reports' ? (
              <Button onClick={generateReport} disabled={loading}>
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
            ) : (
              <Button
                onClick={generateAICommentary}
                disabled={aiLoading || (voice === 'custom' && !customVoice.trim())}
              >
                {aiLoading ? 'Generating...' : hasCommentary ? 'Regenerate All' : 'Generate Commentary'}
              </Button>
            )}
          </div>
        </div>

        {/* Template & Voice Descriptions */}
        {activeTab === 'commentary' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-lg)',
              marginTop: 'var(--space-lg)',
            }}
          >
            <div
              style={{
                padding: 'var(--space-md)',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-light)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.6875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--foreground-muted)',
                  marginBottom: 'var(--space-xs)',
                }}
              >
                Template: {selectedTemplate.name}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>
                {selectedTemplate.description}
              </div>
            </div>

            <div
              style={{
                padding: 'var(--space-md)',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-light)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.6875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--foreground-muted)',
                  marginBottom: 'var(--space-xs)',
                }}
              >
                Voice: {selectedVoice.name}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>
                {selectedVoice.description}
              </div>
            </div>
          </div>
        )}

        {/* Custom Voice Input */}
        {activeTab === 'commentary' && voice === 'custom' && (
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <label
              style={{
                display: 'block',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--foreground)',
                marginBottom: 'var(--space-xs)',
              }}
            >
              Custom Voice Description
            </label>
            <textarea
              value={customVoice}
              onChange={(e) => setCustomVoice(e.target.value)}
              placeholder="Describe your custom voice personality..."
              style={{
                width: '100%',
                minHeight: '100px',
                padding: 'var(--space-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.875rem',
                color: 'var(--foreground)',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-medium)',
                resize: 'vertical',
              }}
            />
          </div>
        )}

        {activeTab === 'commentary' && !hasCommentary && (
          <InfoBanner variant="warning" style={{ marginTop: 'var(--space-lg)' }}>
            AI commentary generation takes 30-60 seconds as it makes multiple Claude API calls.
          </InfoBanner>
        )}
      </div>

      {/* Error Display */}
      {(activeTab === 'reports' ? error : aiError) && (
        <InfoBanner variant="error">{activeTab === 'reports' ? error : aiError}</InfoBanner>
      )}

      {/* Reports Tab Content */}
      {activeTab === 'reports' && (
        <>
          {loading && <LoadingIndicator message="Generating report..." />}

          {reportUrl && !loading && (
            <div className="section-block">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--space-md)',
                }}
              >
                <h2 className="section-title" style={{ margin: 0 }}>
                  {reportType === 'weekly' ? `Week ${week} Report Preview` : 'Postseason Report Preview'}
                </h2>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <Button variant="ghost" onClick={openInNewTab}>
                    Open in New Tab
                  </Button>
                  <Button variant="secondary" onClick={downloadReport}>
                    Download HTML
                  </Button>
                  <Button variant="primary" onClick={exportPdf}>
                    Export PDF
                  </Button>
                </div>
              </div>

              <div
                style={{
                  border: '1px solid var(--border-light)',
                  background: 'white',
                  height: '800px',
                  overflow: 'hidden',
                }}
              >
                <iframe
                  ref={iframeRef}
                  src={reportUrl}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="Report Preview"
                />
              </div>

              <InfoBanner>
                <strong>Tip:</strong> Click &ldquo;Export PDF&rdquo; to open the print dialog. Choose &ldquo;Save as PDF&rdquo; as your destination.
              </InfoBanner>
            </div>
          )}

          {!reportUrl && !loading && (
            <Card title="Instructions">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)' }}>
                <div>
                  <h4 className="font-semibold mb-2">Weekly Recap</h4>
                  <p className="text-sm text-muted">
                    Generates a full week recap including matchup results, standings, top/bottom performers, and playoff picture.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Postseason Report</h4>
                  <p className="text-sm text-muted">
                    Generates a complete postseason summary with playoff bracket, toilet bowl results, seedings, and final standings.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Commentary Tab Content */}
      {activeTab === 'commentary' && (
        <>
          {aiLoading && (
            <div style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
              <LoadingIndicator message={`${selectedVoice.name} is composing...`} />
              <p className="text-muted text-sm mt-2">
                Generating {reportType === 'weekly' ? 'weekly' : 'postseason'} commentary with Claude AI.
              </p>
            </div>
          )}

          {/* Weekly Commentary Display */}
          {weeklyCommentary && reportType === 'weekly' && !aiLoading && (
            <div className="section-block">
              {/* Header with actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--space-lg)',
                  flexWrap: 'wrap',
                  gap: 'var(--space-md)',
                }}
              >
                <SectionHeader
                  title="Generated Commentary"
                  context={`${selectedTemplate.name} • ${selectedVoice.name}`}
                />
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                  {lastSaved && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                      {hasUnsavedChanges ? 'Unsaved changes' : `Saved ${lastSaved.toLocaleTimeString()}`}
                    </span>
                  )}
                  <Button variant="ghost" onClick={saveDraft} disabled={!hasUnsavedChanges}>
                    Save Draft
                  </Button>
                  <Button variant="ghost" onClick={copyCommentaryToClipboard}>
                    Copy All
                  </Button>
                  <Button variant="ghost" onClick={clearDraft}>
                    Clear
                  </Button>
                </div>
              </div>

              <InfoBanner style={{ marginBottom: 'var(--space-lg)' }}>
                Click <strong>Edit</strong> to modify any section, or <strong>Regenerate</strong> to get a new AI version.
              </InfoBanner>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                <EditableCommentarySection
                  sectionKey="opener"
                  title="Opening"
                  content={weeklyCommentary.opener}
                  variant="primary"
                  isEditing={editingSection === 'opener'}
                  isRegenerating={regeneratingSection === 'opener'}
                  onEdit={() => setEditingSection(editingSection === 'opener' ? null : 'opener')}
                  onRegenerate={() => regenerateSection('opener', 'Opening')}
                  onContentChange={(content) => updateSectionContent('opener', content)}
                />

                <EditableCommentarySection
                  sectionKey="standingsAnalysis"
                  title="Standings Analysis"
                  content={weeklyCommentary.standingsAnalysis}
                  variant="default"
                  isEditing={editingSection === 'standingsAnalysis'}
                  isRegenerating={regeneratingSection === 'standingsAnalysis'}
                  onEdit={() => setEditingSection(editingSection === 'standingsAnalysis' ? null : 'standingsAnalysis')}
                  onRegenerate={() => regenerateSection('standingsAnalysis', 'Standings Analysis')}
                  onContentChange={(content) => updateSectionContent('standingsAnalysis', content)}
                />

                <EditableCommentarySection
                  sectionKey="topPerformerSpotlight"
                  title="Top Performer Spotlight"
                  content={weeklyCommentary.topPerformerSpotlight}
                  variant="win"
                  isEditing={editingSection === 'topPerformerSpotlight'}
                  isRegenerating={regeneratingSection === 'topPerformerSpotlight'}
                  onEdit={() => setEditingSection(editingSection === 'topPerformerSpotlight' ? null : 'topPerformerSpotlight')}
                  onRegenerate={() => regenerateSection('topPerformerSpotlight', 'Top Performer')}
                  onContentChange={(content) => updateSectionContent('topPerformerSpotlight', content)}
                />

                <EditableCommentarySection
                  sectionKey="bottomPerformerRoast"
                  title="Bottom Performer"
                  content={weeklyCommentary.bottomPerformerRoast}
                  variant="loss"
                  isEditing={editingSection === 'bottomPerformerRoast'}
                  isRegenerating={regeneratingSection === 'bottomPerformerRoast'}
                  onEdit={() => setEditingSection(editingSection === 'bottomPerformerRoast' ? null : 'bottomPerformerRoast')}
                  onRegenerate={() => regenerateSection('bottomPerformerRoast', 'Bottom Performer')}
                  onContentChange={(content) => updateSectionContent('bottomPerformerRoast', content)}
                />

                {weeklyCommentary.playoffPicture && (
                  <EditableCommentarySection
                    sectionKey="playoffPicture"
                    title="Playoff Picture"
                    content={weeklyCommentary.playoffPicture}
                    variant="gold"
                    isEditing={editingSection === 'playoffPicture'}
                    isRegenerating={regeneratingSection === 'playoffPicture'}
                    onEdit={() => setEditingSection(editingSection === 'playoffPicture' ? null : 'playoffPicture')}
                    onRegenerate={() => regenerateSection('playoffPicture', 'Playoff Picture')}
                    onContentChange={(content) => updateSectionContent('playoffPicture', content)}
                  />
                )}

                {/* Matchup Commentaries */}
                <Card title="Matchup Commentaries">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {Object.entries(weeklyCommentary.matchupCommentaries).map(([matchup, comment]) => (
                      <EditableMatchupSection
                        key={matchup}
                        matchupKey={matchup}
                        content={comment}
                        isEditing={editingSection === `matchup-${matchup}`}
                        onEdit={() => setEditingSection(editingSection === `matchup-${matchup}` ? null : `matchup-${matchup}`)}
                        onContentChange={(content) => updateMatchupCommentary(matchup, content)}
                      />
                    ))}
                  </div>
                </Card>

                <EditableCommentarySection
                  sectionKey="closer"
                  title="Closing"
                  content={weeklyCommentary.closer}
                  variant="primary"
                  isEditing={editingSection === 'closer'}
                  isRegenerating={regeneratingSection === 'closer'}
                  onEdit={() => setEditingSection(editingSection === 'closer' ? null : 'closer')}
                  onRegenerate={() => regenerateSection('closer', 'Closing')}
                  onContentChange={(content) => updateSectionContent('closer', content)}
                />
              </div>
            </div>
          )}

          {/* Postseason Commentary Display */}
          {postseasonCommentary && reportType === 'postseason' && !aiLoading && (
            <div className="section-block">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--space-lg)',
                  flexWrap: 'wrap',
                  gap: 'var(--space-md)',
                }}
              >
                <SectionHeader
                  title="Generated Commentary"
                  context={`${selectedTemplate.name} • ${selectedVoice.name}`}
                />
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                  {lastSaved && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                      {hasUnsavedChanges ? 'Unsaved changes' : `Saved ${lastSaved.toLocaleTimeString()}`}
                    </span>
                  )}
                  <Button variant="ghost" onClick={saveDraft} disabled={!hasUnsavedChanges}>
                    Save Draft
                  </Button>
                  <Button variant="ghost" onClick={copyCommentaryToClipboard}>
                    Copy All
                  </Button>
                  <Button variant="ghost" onClick={clearDraft}>
                    Clear
                  </Button>
                </div>
              </div>

              <InfoBanner style={{ marginBottom: 'var(--space-lg)' }}>
                Click <strong>Edit</strong> to modify any section, or <strong>Regenerate</strong> to get a new AI version.
              </InfoBanner>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                <EditableCommentarySection
                  sectionKey="recap"
                  title="Season Recap"
                  content={postseasonCommentary.recap}
                  variant="gold"
                  isEditing={editingSection === 'recap'}
                  isRegenerating={regeneratingSection === 'recap'}
                  onEdit={() => setEditingSection(editingSection === 'recap' ? null : 'recap')}
                  onRegenerate={() => regenerateSection('recap', 'Season Recap')}
                  onContentChange={(content) => updateSectionContent('recap', content)}
                />

                <EditableCommentarySection
                  sectionKey="championPath"
                  title="Champion's Path"
                  content={postseasonCommentary.championPath}
                  variant="win"
                  isEditing={editingSection === 'championPath'}
                  isRegenerating={regeneratingSection === 'championPath'}
                  onEdit={() => setEditingSection(editingSection === 'championPath' ? null : 'championPath')}
                  onRegenerate={() => regenerateSection('championPath', "Champion's Path")}
                  onContentChange={(content) => updateSectionContent('championPath', content)}
                />

                <EditableCommentarySection
                  sectionKey="toiletBowlSummary"
                  title="Toilet Bowl Summary"
                  content={postseasonCommentary.toiletBowlSummary}
                  variant="loss"
                  isEditing={editingSection === 'toiletBowlSummary'}
                  isRegenerating={regeneratingSection === 'toiletBowlSummary'}
                  onEdit={() => setEditingSection(editingSection === 'toiletBowlSummary' ? null : 'toiletBowlSummary')}
                  onRegenerate={() => regenerateSection('toiletBowlSummary', 'Toilet Bowl Summary')}
                  onContentChange={(content) => updateSectionContent('toiletBowlSummary', content)}
                />
              </div>
            </div>
          )}

          {/* Empty state */}
          {!aiLoading && !weeklyCommentary && !postseasonCommentary && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)' }}>
              <Card title="Templates">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  {Object.values(REPORT_TEMPLATES).map((t) => (
                    <div
                      key={t.id}
                      style={{
                        padding: 'var(--space-md)',
                        background: t.id === template ? 'rgba(45, 80, 22, 0.1)' : 'var(--surface-sunken)',
                        border: `1px solid ${t.id === template ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                        cursor: 'pointer',
                      }}
                      onClick={() => setTemplate(t.id)}
                    >
                      <div className="font-semibold" style={{ color: 'var(--accent-primary)' }}>
                        {t.name}
                      </div>
                      <div className="text-sm text-muted">{t.description}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Voices">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  {Object.values(VOICE_PRESETS).map((v) => (
                    <div
                      key={v.id}
                      style={{
                        padding: 'var(--space-md)',
                        background: v.id === voice ? 'rgba(45, 80, 22, 0.1)' : 'var(--surface-sunken)',
                        border: `1px solid ${v.id === voice ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                        cursor: 'pointer',
                      }}
                      onClick={() => setVoice(v.id)}
                    >
                      <div className="font-semibold" style={{ color: 'var(--accent-primary)' }}>
                        {v.name}
                      </div>
                      <div className="text-sm text-muted">{v.description}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Editable commentary section component
function EditableCommentarySection({
  sectionKey,
  title,
  content,
  variant = 'default',
  isEditing,
  isRegenerating,
  onEdit,
  onRegenerate,
  onContentChange,
}: {
  sectionKey: string;
  title: string;
  content: string;
  variant?: 'default' | 'primary' | 'win' | 'loss' | 'gold';
  isEditing: boolean;
  isRegenerating: boolean;
  onEdit: () => void;
  onRegenerate: () => void;
  onContentChange: (content: string) => void;
}) {
  const borderColors = {
    default: 'var(--border-light)',
    primary: 'var(--accent-primary)',
    win: 'var(--win)',
    loss: 'var(--loss)',
    gold: 'var(--accent-gold)',
  };

  const titleColors = {
    default: 'var(--foreground)',
    primary: 'var(--accent-primary)',
    win: 'var(--win)',
    loss: 'var(--loss)',
    gold: 'var(--accent-gold)',
  };

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-sm)',
        }}
      >
        <h3
          className="font-semibold text-sm uppercase tracking-wide"
          style={{ color: titleColors[variant], margin: 0 }}
        >
          {title}
        </h3>
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <button
            onClick={onEdit}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
              background: isEditing ? 'var(--accent-primary)' : 'transparent',
              color: isEditing ? 'var(--background)' : 'var(--foreground-muted)',
              border: '1px solid var(--border-light)',
              cursor: 'pointer',
            }}
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
              background: 'transparent',
              color: 'var(--foreground-muted)',
              border: '1px solid var(--border-light)',
              cursor: isRegenerating ? 'wait' : 'pointer',
              opacity: isRegenerating ? 0.5 : 1,
            }}
          >
            {isRegenerating ? '...' : '↻'}
          </button>
        </div>
      </div>

      <div
        style={{
          borderLeft: `3px solid ${borderColors[variant]}`,
          paddingLeft: 'var(--space-md)',
        }}
      >
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            style={{
              width: '100%',
              minHeight: '150px',
              padding: 'var(--space-sm)',
              fontFamily: 'var(--font-serif)',
              fontSize: '1rem',
              lineHeight: 1.6,
              color: 'var(--foreground)',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--border-medium)',
              resize: 'vertical',
            }}
          />
        ) : (
          <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{content}</p>
        )}
      </div>
    </div>
  );
}

// Editable matchup section component
function EditableMatchupSection({
  matchupKey,
  content,
  isEditing,
  onEdit,
  onContentChange,
}: {
  matchupKey: string;
  content: string;
  isEditing: boolean;
  onEdit: () => void;
  onContentChange: (content: string) => void;
}) {
  return (
    <div
      style={{
        borderLeft: '2px solid var(--accent-secondary)',
        paddingLeft: 'var(--space-md)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.25rem',
        }}
      >
        <div className="text-sm font-semibold" style={{ color: 'var(--accent-secondary)' }}>
          {matchupKey}
        </div>
        <button
          onClick={onEdit}
          style={{
            padding: '0.125rem 0.375rem',
            fontSize: '0.6875rem',
            fontFamily: 'var(--font-sans)',
            background: isEditing ? 'var(--accent-primary)' : 'transparent',
            color: isEditing ? 'var(--background)' : 'var(--foreground-muted)',
            border: '1px solid var(--border-light)',
            cursor: 'pointer',
          }}
        >
          {isEditing ? 'Done' : 'Edit'}
        </button>
      </div>
      {isEditing ? (
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          style={{
            width: '100%',
            minHeight: '80px',
            padding: 'var(--space-sm)',
            fontFamily: 'var(--font-serif)',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
            color: 'var(--foreground)',
            background: 'var(--surface-sunken)',
            border: '1px solid var(--border-medium)',
            resize: 'vertical',
          }}
        />
      ) : (
        <p style={{ margin: 0 }}>{content}</p>
      )}
    </div>
  );
}
