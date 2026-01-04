// HTML Report Generator for Cob Chronicles
// Generates styled HTML reports that can be converted to PDF via browser print

import { cobChroniclesTheme } from './theme';

const { colors, fonts, fontSize } = cobChroniclesTheme;

// Markdown to HTML converter for AI commentary
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/##\s+(.+?)$/gm, '<strong>$1</strong>')
    .replace(/—/g, '&mdash;')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, ' ');
}

// CSS Stylesheet for reports
export const reportStylesheet = `
  @page {
    size: letter;
    margin: 0.75in 0.75in 1in 0.75in;
  }
  
  @media print {
    /* Force background colors and images */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
    }
    
    body {
      padding: 0 !important;
      font-size: 11pt;
    }
    
    .report-container {
      max-width: none !important;
      width: 100% !important;
      padding: 0 !important;
    }
    
    /* Page break utilities */
    .page-break-before {
      page-break-before: always;
      break-before: page;
    }
    
    .page-break-after {
      page-break-after: always;
      break-after: page;
    }
    
    .page-break {
      page-break-before: always;
      break-before: page;
    }
    
    .no-break,
    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    /* Keep headers with content */
    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid;
      break-after: avoid;
    }
    
    /* Keep section header with following content */
    .section-header {
      page-break-after: avoid;
      break-after: avoid;
    }
    
    .section-header + * {
      page-break-before: avoid;
      break-before: avoid;
    }
    
    /* Keep elements together - CRITICAL */
    .matchup-card {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .award-card {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .stat-box {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .stat-grid {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    table {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    /* Keep table header with first rows */
    thead {
      display: table-header-group;
    }
    
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    /* Force page breaks before major sections */
    .section-break-before {
      page-break-before: always;
      break-before: page;
    }
    
    /* Callouts and highlight boxes */
    .callout, .highlight-box {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    /* Hide screen-only elements */
    .no-print, .screen-only {
      display: none !important;
    }
    
    /* Matchup grid - allow wrapping but keep cards together */
    .matchup-grid {
      page-break-inside: auto;
      break-inside: auto;
    }
    
    /* Footer on each page */
    .report-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 9pt;
      color: #666;
      padding: 0.25in 0;
    }
  }
  
  * {
    box-sizing: border-box;
  }
  
  body {
    font-family: ${fonts.body};
    color: ${colors.textPrimary};
    background-color: ${colors.parchment};
    line-height: 1.6;
    margin: 0;
    padding: 2rem;
  }
  
  .report-container {
    max-width: 850px;
    margin: 0 auto;
    background-color: ${colors.parchment};
  }
  
  /* Editable content styles */
  [contenteditable="true"] {
    outline: none;
    border-radius: 4px;
    transition: box-shadow 0.2s ease;
  }
  
  [contenteditable="true"]:hover {
    box-shadow: 0 0 0 2px rgba(45, 80, 22, 0.2);
  }
  
  [contenteditable="true"]:focus {
    box-shadow: 0 0 0 2px ${colors.headerGreen};
  }
  
  /* Typography */
  .report-title {
    font-family: ${fonts.heading};
    font-size: ${fontSize.title};
    color: ${colors.headerGreen};
    text-align: center;
    margin-bottom: 0.5rem;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  
  .report-subtitle {
    font-family: ${fonts.heading};
    font-size: ${fontSize.h2};
    color: ${colors.accentRust};
    text-align: center;
    margin-bottom: 2rem;
    font-style: italic;
  }
  
  .section-header {
    font-family: ${fonts.heading};
    font-size: ${fontSize.h2};
    color: ${colors.headerGreen};
    border-bottom: 3px solid ${colors.headerGreen};
    padding-bottom: 0.5rem;
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-weight: bold;
  }
  
  .subsection-header {
    font-family: ${fonts.heading};
    font-size: ${fontSize.h3};
    color: ${colors.accentRust};
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-weight: bold;
  }
  
  p {
    margin-bottom: 1rem;
  }
  
  /* Editable paragraph */
  p.editable-content {
    min-height: 1.5em;
    padding: 0.25rem;
    margin: -0.25rem;
  }
  
  /* Stat boxes */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin: 1.5rem 0;
  }
  
  .stat-box {
    background-color: ${colors.parchmentDark};
    border: 2px solid ${colors.borderDark};
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
  }
  
  .stat-label {
    font-size: ${fontSize.small};
    color: ${colors.textSecondary};
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 0.25rem;
  }
  
  .stat-value {
    font-size: ${fontSize.h2};
    font-weight: bold;
    color: ${colors.headerGreen};
  }
  
  .stat-value.rust {
    color: ${colors.accentRust};
  }
  
  .stat-value.gold {
    color: ${colors.gold};
  }
  
  .stat-detail {
    font-size: ${fontSize.tiny};
    color: ${colors.textSecondary};
    margin-top: 0.25rem;
  }
  
  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    font-size: ${fontSize.small};
  }
  
  th {
    background-color: ${colors.headerGreen};
    color: white;
    text-align: left;
    padding: 0.75rem 0.5rem;
    font-weight: bold;
    text-transform: uppercase;
    font-size: ${fontSize.tiny};
    letter-spacing: 1px;
  }
  
  td {
    padding: 0.5rem;
    border-bottom: 1px solid ${colors.borderLight};
  }
  
  tr:nth-child(even) {
    background-color: ${colors.parchmentDark};
  }
  
  tr.highlight {
    background-color: rgba(45, 80, 22, 0.1);
  }
  
  .text-right {
    text-align: right;
  }
  
  .text-center {
    text-align: center;
  }
  
  /* Matchup cards */
  .matchup-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
  }
  
  .matchup-card {
    background-color: ${colors.parchmentDark};
    border: 2px solid ${colors.borderDark};
    border-radius: 8px;
    padding: 1rem;
  }
  
  .matchup-card.playoff {
    border-color: ${colors.gold};
    border-width: 3px;
  }
  
  .matchup-card.toilet {
    border-color: ${colors.toiletBrown};
  }
  
  .matchup-header {
    font-size: ${fontSize.tiny};
    color: ${colors.textSecondary};
    text-transform: uppercase;
    margin-bottom: 0.5rem;
    display: flex;
    justify-content: space-between;
  }
  
  .matchup-teams {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .matchup-team {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0;
  }
  
  .matchup-team.winner {
    color: ${colors.headerGreen};
    font-weight: bold;
  }
  
  .matchup-team.loser {
    color: ${colors.textSecondary};
  }
  
  .team-seed {
    font-size: ${fontSize.tiny};
    color: ${colors.textSecondary};
    margin-right: 0.5rem;
  }
  
  .team-score {
    font-weight: bold;
    font-size: ${fontSize.h3};
  }
  
  .matchup-margin {
    font-size: ${fontSize.tiny};
    color: ${colors.textSecondary};
    text-align: right;
    margin-top: 0.5rem;
    border-top: 1px solid ${colors.borderLight};
    padding-top: 0.5rem;
  }
  
  .matchup-commentary {
    font-size: 0.85rem;
    color: ${colors.textPrimary};
    font-style: italic;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px dashed ${colors.borderLight};
    line-height: 1.4;
  }
  
  /* Badges */
  .badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: ${fontSize.tiny};
    font-weight: bold;
    text-transform: uppercase;
  }
  
  .badge-gold {
    background-color: ${colors.gold};
    color: #000;
  }
  
  .badge-silver {
    background-color: ${colors.silver};
    color: #000;
  }
  
  .badge-bronze {
    background-color: ${colors.bronze};
    color: #fff;
  }
  
  .badge-toilet {
    background-color: ${colors.toiletBrown};
    color: #fff;
  }
  
  .badge-green {
    background-color: ${colors.headerGreen};
    color: #fff;
  }
  
  .badge-rust {
    background-color: ${colors.accentRust};
    color: #fff;
  }
  
  /* Callouts */
  .callout {
    background-color: ${colors.headerGreen};
    color: white;
    padding: 1.5rem;
    border-radius: 8px;
    margin: 1.5rem 0;
    text-align: center;
    font-size: ${fontSize.h3};
    font-style: italic;
  }
  
  .highlight-box {
    background-color: ${colors.parchmentDark};
    border-left: 4px solid ${colors.accentRust};
    padding: 1rem;
    margin: 1rem 0;
    font-style: italic;
  }
  
  /* Awards section */
  .award-card {
    background-color: ${colors.parchmentDark};
    border: 2px solid ${colors.borderDark};
    border-radius: 8px;
    padding: 1rem;
    margin: 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .award-icon {
    font-size: 2rem;
  }
  
  .award-details {
    flex: 1;
  }
  
  .award-title {
    font-weight: bold;
    color: ${colors.headerGreen};
  }
  
  .award-winner {
    font-size: ${fontSize.h3};
  }
  
  .award-stat {
    font-size: ${fontSize.small};
    color: ${colors.textSecondary};
  }
  
  /* Footer */
  .report-footer {
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 2px solid ${colors.borderDark};
    text-align: center;
    font-size: ${fontSize.small};
    color: ${colors.textSecondary};
    font-style: italic;
  }
  
  /* Utility */
  .green { color: ${colors.headerGreen}; }
  .rust { color: ${colors.accentRust}; }
  .gold { color: ${colors.gold}; }
  .muted { color: ${colors.textSecondary}; }
  .bold { font-weight: bold; }
  .italic { font-style: italic; }
  
  .mt-1 { margin-top: 0.5rem; }
  .mt-2 { margin-top: 1rem; }
  .mb-1 { margin-bottom: 0.5rem; }
  .mb-2 { margin-bottom: 1rem; }
`;

// Helper to generate full HTML document
export function generateHtmlDocument(
  title: string,
  content: string,
  options: { includeFooter?: boolean; footerText?: string; editable?: boolean } = {}
): string {
  const { includeFooter = true, footerText = 'The Cob Chronicles — OG Papio Dynasty League', editable = false } = options;
  
  const editableScript = editable ? `
    <script>
      // Track changes for WYSIWYG editing
      document.addEventListener('input', function(e) {
        if (e.target.hasAttribute('contenteditable')) {
          window.parent?.postMessage({
            type: 'contentChange',
            html: document.querySelector('.report-container').innerHTML
          }, '*');
        }
      });
    </script>
  ` : '';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${reportStylesheet}</style>
</head>
<body>
  <div class="report-container">
    ${content}
    ${includeFooter ? `<div class="report-footer">${footerText}</div>` : ''}
  </div>
  ${editableScript}
</body>
</html>`;
}

// Component builders

// Type for matchup card data (extracted to avoid circular reference)
export interface MatchupCardData {
  type?: string;
  week?: number;
  team1: { name: string; seed?: number; score: number; isWinner: boolean };
  team2: { name: string; seed?: number; score: number; isWinner: boolean };
  margin: number;
  cardClass?: string;
  commentary?: string; // AI-generated commentary for this matchup
}

export const html: {
  title: (text: string, editable?: boolean) => string;
  subtitle: (text: string, editable?: boolean) => string;
  section: (title: string, content: string, options?: { sectionId?: string; breakBefore?: boolean }) => string;
  subsection: (title: string, content: string) => string;
  paragraph: (text: string, editable?: boolean) => string;
  statGrid: (stats: Array<{ label: string; value: string | number; detail?: string; color?: string }>) => string;
  table: (headers: string[], rows: string[][], options?: { highlightRows?: number[] }) => string;
  matchupCard: (matchup: MatchupCardData, editable?: boolean) => string;
  matchupGrid: (matchups: MatchupCardData[], editable?: boolean) => string;
  callout: (text: string, editable?: boolean) => string;
  highlightBox: (text: string, editable?: boolean) => string;
  badge: (text: string, type?: 'gold' | 'silver' | 'bronze' | 'toilet' | 'green' | 'rust') => string;
  awardCard: (award: { icon: string; title: string; winner: string; stat: string }) => string;
  pageBreak: () => string;
  noBreak: (content: string) => string;
} = {
  title: (text: string, editable = false) => 
    `<h1 class="report-title"${editable ? ' contenteditable="true"' : ''}>${text}</h1>`,
  
  subtitle: (text: string, editable = false) => 
    `<div class="report-subtitle"${editable ? ' contenteditable="true"' : ''}>${text}</div>`,
  
  section: (title: string, content: string, options: { sectionId?: string; breakBefore?: boolean } = {}) => {
    const { sectionId, breakBefore } = options;
    const classes = ['section-header'];
    if (breakBefore) classes.push('section-break-before');
    return `
    <h2 class="${classes.join(' ')}"${sectionId ? ` data-section="${sectionId}"` : ''}>${title}</h2>
    <div class="avoid-break">
      ${content}
    </div>
  `;
  },
  
  subsection: (title: string, content: string) => `
    <h3 class="subsection-header">${title}</h3>
    ${content}
  `,
  
  paragraph: (text: string, editable = false) => 
    `<p class="${editable ? 'editable-content' : ''}"${editable ? ' contenteditable="true"' : ''}>${renderMarkdown(text)}</p>`,
  
  statGrid: (stats: Array<{ label: string; value: string | number; detail?: string; color?: string }>) => `
    <div class="stat-grid avoid-break">
      ${stats.map(s => `
        <div class="stat-box">
          <div class="stat-label">${s.label}</div>
          <div class="stat-value ${s.color || ''}">${s.value}</div>
          ${s.detail ? `<div class="stat-detail">${s.detail}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `,
  
  table: (headers: string[], rows: string[][], options: { highlightRows?: number[] } = {}) => {
    const { highlightRows = [] } = options;
    return `
      <div class="avoid-break">
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map((row, i) => `
              <tr class="${highlightRows.includes(i) ? 'highlight' : ''}">
                ${row.map(cell => `<td>${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },
  
  matchupCard: (matchup: MatchupCardData, editable = false) => `
    <div class="matchup-card ${matchup.cardClass || ''}">
      <div class="matchup-header">
        <span>${matchup.type || 'Matchup'}</span>
        ${matchup.week ? `<span>Week ${matchup.week}</span>` : ''}
      </div>
      <div class="matchup-teams">
        <div class="matchup-team ${matchup.team1.isWinner ? 'winner' : 'loser'}">
          <span>
            ${matchup.team1.seed ? `<span class="team-seed">#${matchup.team1.seed}</span>` : ''}
            ${matchup.team1.name}
            ${matchup.team1.isWinner ? ' 🏆' : ''}
          </span>
          <span class="team-score">${matchup.team1.score.toFixed(2)}</span>
        </div>
        <div class="matchup-team ${matchup.team2.isWinner ? 'winner' : 'loser'}">
          <span>
            ${matchup.team2.seed ? `<span class="team-seed">#${matchup.team2.seed}</span>` : ''}
            ${matchup.team2.name}
            ${matchup.team2.isWinner ? ' 🏆' : ''}
          </span>
          <span class="team-score">${matchup.team2.score.toFixed(2)}</span>
        </div>
      </div>
      <div class="matchup-margin">Margin: ${matchup.margin.toFixed(2)}</div>
      ${matchup.commentary ? `<div class="matchup-commentary"${editable ? ' contenteditable="true"' : ''}>${renderMarkdown(matchup.commentary)}</div>` : ''}
    </div>
  `,
  
  matchupGrid: (matchups: MatchupCardData[], editable = false) => `
    <div class="matchup-grid">
      ${matchups.map(m => html.matchupCard(m, editable)).join('')}
    </div>
  `,
  
  callout: (text: string, editable = false) => 
    `<div class="callout avoid-break"${editable ? ' contenteditable="true"' : ''}>${renderMarkdown(text)}</div>`,
  
  highlightBox: (text: string, editable = false) => 
    `<div class="highlight-box avoid-break"${editable ? ' contenteditable="true"' : ''}>${renderMarkdown(text)}</div>`,
  
  badge: (text: string, type: 'gold' | 'silver' | 'bronze' | 'toilet' | 'green' | 'rust' = 'green') => 
    `<span class="badge badge-${type}">${text}</span>`,
  
  awardCard: (award: { icon: string; title: string; winner: string; stat: string }) => `
    <div class="award-card">
      <div class="award-icon">${award.icon}</div>
      <div class="award-details">
        <div class="award-title">${award.title}</div>
        <div class="award-winner">${award.winner}</div>
        <div class="award-stat">${award.stat}</div>
      </div>
    </div>
  `,
  
  pageBreak: () => `<div class="page-break"></div>`,
  
  noBreak: (content: string) => `<div class="avoid-break">${content}</div>`,
};

// Export markdown renderer for external use
export { renderMarkdown };

export default { generateHtmlDocument, html, reportStylesheet, renderMarkdown };
