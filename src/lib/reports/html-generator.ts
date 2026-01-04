// HTML Report Generator for Cob Chronicles
// Generates styled HTML reports that can be converted to PDF via browser print

import { cobChroniclesTheme } from './theme';

const { colors, fonts, fontSize } = cobChroniclesTheme;

// CSS Stylesheet for reports
export const reportStylesheet = `
  @page {
    size: letter;
    margin: 0.5in;
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
    }
    
    .report-container {
      max-width: none !important;
      width: 100% !important;
      padding: 0 !important;
    }
    
    /* Page break utilities */
    .page-break-before {
      page-break-before: always;
    }
    
    .page-break-after {
      page-break-after: always;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    .no-break,
    .avoid-break {
      page-break-inside: avoid;
    }
    
    /* Keep headers with content */
    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid;
    }
    
    /* Keep elements together */
    table, .matchup-card, .stat-box, .award-card {
      page-break-inside: avoid;
    }
    
    /* Hide screen-only elements */
    .no-print, .screen-only {
      display: none !important;
    }
    
    /* Optimize for print */
    .section-header {
      page-break-after: avoid;
    }
    
    .matchup-grid {
      page-break-inside: avoid;
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
  options: { includeFooter?: boolean; footerText?: string } = {}
): string {
  const { includeFooter = true, footerText = 'The Cob Chronicles — OG Papio Dynasty League' } = options;
  
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
</body>
</html>`;
}

// Component builders
export const html = {
  title: (text: string) => `<h1 class="report-title">${text}</h1>`,
  
  subtitle: (text: string) => `<div class="report-subtitle">${text}</div>`,
  
  section: (title: string, content: string) => `
    <h2 class="section-header">${title}</h2>
    ${content}
  `,
  
  subsection: (title: string, content: string) => `
    <h3 class="subsection-header">${title}</h3>
    ${content}
  `,
  
  paragraph: (text: string) => `<p>${text}</p>`,
  
  statGrid: (stats: Array<{ label: string; value: string | number; detail?: string; color?: string }>) => `
    <div class="stat-grid">
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
    `;
  },
  
  matchupCard: (matchup: {
    type?: string;
    week?: number;
    team1: { name: string; seed?: number; score: number; isWinner: boolean };
    team2: { name: string; seed?: number; score: number; isWinner: boolean };
    margin: number;
    cardClass?: string;
  }) => `
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
    </div>
  `,
  
  matchupGrid: (matchups: Parameters<typeof html.matchupCard>[0][]) => `
    <div class="matchup-grid">
      ${matchups.map(m => html.matchupCard(m)).join('')}
    </div>
  `,
  
  callout: (text: string) => `<div class="callout">${text}</div>`,
  
  highlightBox: (text: string) => `<div class="highlight-box">${text}</div>`,
  
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
  
  noBreak: (content: string) => `<div class="no-break">${content}</div>`,
};

export default { generateHtmlDocument, html, reportStylesheet };
