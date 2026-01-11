// The Ledger Report Generator
// A stats-heavy, minimal prose report format focusing on tables and data

import { generateHtmlDocument, html } from './html-generator';
import { cobChroniclesTheme } from './theme';
import { WeeklyCommentary } from '@/lib/ai';

const { colors } = cobChroniclesTheme;

// ============================================
// TYPES
// ============================================

interface MatchupData {
  week: number;
  team1: { name: string; points: number; managerId: string };
  team2: { name: string; points: number; managerId: string };
  winner: { name: string; managerId: string };
  pointDifferential: number;
  isPlayoff: boolean;
  matchupType?: string;
}

interface StandingsEntry {
  rank: number;
  displayName: string;
  managerId?: string;
  record: {
    h2h: { wins: number; losses: number };
    median: { wins: number; losses: number };
    combined: { wins: number; losses: number };
    allPlay: { wins: number; losses: number };
  };
  points: { for: number; against: number };
  trend?: 'up' | 'down' | 'same';
  trendAmount?: number;
}

interface WeeklyScore {
  managerId?: string;
  managerName: string;
  points: { for: number; against: number };
  results: {
    h2hWin: boolean;
    medianWin: boolean;
    weeklyRank: number;
    allPlayWins: number;
    allPlayLosses: number;
  };
  opponentName: string;
}

interface LedgerReportData {
  season: number;
  week: number;
  matchups: MatchupData[];
  standings: StandingsEntry[];
  weeklyScores: WeeklyScore[];
  summary: {
    median: number;
    highest: number;
    lowest: number;
    topScorer: string;
    bottomScorer: string;
  };
  playoffWeekStart: number;
}

interface LedgerReportOptions {
  commentary?: WeeklyCommentary;
  showAllPlayRecord?: boolean;
  showPointsDifferential?: boolean;
  compactMode?: boolean;
}

// ============================================
// LEDGER-SPECIFIC STYLES
// ============================================

const ledgerStyles = `
  /* Ledger-specific overrides for compact, data-focused layout */

  .ledger-container {
    font-size: 0.9rem;
  }

  .ledger-title {
    font-family: ${cobChroniclesTheme.fonts.heading};
    font-size: 2rem;
    color: ${colors.headerGreen};
    text-align: center;
    margin-bottom: 0.25rem;
    font-weight: bold;
    letter-spacing: 3px;
  }

  .ledger-subtitle {
    font-family: ${cobChroniclesTheme.fonts.body};
    font-size: 1rem;
    color: ${colors.textSecondary};
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .ledger-section {
    margin: 1.5rem 0;
  }

  .ledger-section-title {
    font-family: ${cobChroniclesTheme.fonts.heading};
    font-size: 1.1rem;
    color: ${colors.headerGreen};
    border-bottom: 2px solid ${colors.headerGreen};
    padding-bottom: 0.25rem;
    margin-bottom: 0.75rem;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .ledger-summary {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    background: ${colors.parchmentDark};
    padding: 0.75rem;
    border-radius: 4px;
  }

  .ledger-stat {
    text-align: center;
    padding: 0.5rem;
  }

  .ledger-stat-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    color: ${colors.textSecondary};
    letter-spacing: 0.5px;
  }

  .ledger-stat-value {
    font-size: 1.1rem;
    font-weight: bold;
    color: ${colors.headerGreen};
  }

  .ledger-stat-detail {
    font-size: 0.7rem;
    color: ${colors.textSecondary};
  }

  /* Compact table styles */
  .ledger-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    margin: 0.5rem 0;
  }

  .ledger-table th {
    background: ${colors.headerGreen};
    color: white;
    padding: 0.4rem 0.5rem;
    text-align: left;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  .ledger-table td {
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid ${colors.borderLight};
  }

  .ledger-table tr:nth-child(even) {
    background: ${colors.parchmentDark};
  }

  .ledger-table .numeric {
    text-align: right;
    font-family: ${cobChroniclesTheme.fonts.mono};
    font-size: 0.75rem;
  }

  .ledger-table .rank {
    font-weight: bold;
    width: 2rem;
    text-align: center;
  }

  .ledger-table .highlight {
    background: rgba(45, 80, 22, 0.1);
  }

  /* Matchup grid - compact version */
  .ledger-matchups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 0.5rem;
  }

  .ledger-matchup {
    background: ${colors.parchmentDark};
    border: 1px solid ${colors.borderDark};
    border-radius: 4px;
    padding: 0.5rem;
    font-size: 0.85rem;
  }

  .ledger-matchup-header {
    font-size: 0.65rem;
    color: ${colors.textSecondary};
    text-transform: uppercase;
    margin-bottom: 0.25rem;
  }

  .ledger-matchup-row {
    display: flex;
    justify-content: space-between;
    padding: 0.15rem 0;
  }

  .ledger-matchup-winner {
    color: ${colors.headerGreen};
    font-weight: bold;
  }

  .ledger-matchup-loser {
    color: ${colors.textSecondary};
  }

  .ledger-matchup-score {
    font-family: ${cobChroniclesTheme.fonts.mono};
    font-weight: bold;
  }

  .ledger-matchup-margin {
    font-size: 0.7rem;
    color: ${colors.textSecondary};
    text-align: right;
    margin-top: 0.25rem;
  }

  /* Quick commentary - minimal */
  .ledger-note {
    font-size: 0.8rem;
    font-style: italic;
    color: ${colors.textSecondary};
    margin: 0.5rem 0;
    padding: 0.5rem;
    background: ${colors.parchmentDark};
    border-left: 3px solid ${colors.accentRust};
  }

  /* Awards - compact */
  .ledger-awards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    margin: 0.75rem 0;
  }

  .ledger-award {
    text-align: center;
    padding: 0.5rem;
    background: ${colors.parchmentDark};
    border-radius: 4px;
  }

  .ledger-award-icon {
    font-size: 1.25rem;
  }

  .ledger-award-title {
    font-size: 0.65rem;
    text-transform: uppercase;
    color: ${colors.textSecondary};
  }

  .ledger-award-winner {
    font-weight: bold;
    font-size: 0.85rem;
  }

  .ledger-award-stat {
    font-size: 0.7rem;
    color: ${colors.textSecondary};
    font-family: ${cobChroniclesTheme.fonts.mono};
  }

  /* Footer */
  .ledger-footer {
    margin-top: 1.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid ${colors.borderDark};
    text-align: center;
    font-size: 0.7rem;
    color: ${colors.textSecondary};
  }

  @media print {
    .ledger-container {
      font-size: 9pt;
    }

    .ledger-table {
      font-size: 8pt;
    }

    .ledger-matchups {
      gap: 0.3rem;
    }
  }
`;

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

function formatPoints(points: number): string {
  return points.toFixed(2);
}

function getWeekTitle(season: number, week: number, playoffWeekStart: number): string {
  if (week >= playoffWeekStart) {
    const playoffWeek = week - playoffWeekStart + 1;
    if (playoffWeek === 1) return 'Wildcard Round';
    if (playoffWeek === 2) return 'Semifinals';
    if (playoffWeek === 3) return 'Championship Week';
    return `Playoff Week ${playoffWeek}`;
  }
  return `Week ${week}`;
}

// ============================================
// MAIN GENERATOR
// ============================================

export function generateLedgerReport(
  data: LedgerReportData,
  options: LedgerReportOptions = {}
): string {
  const { season, week, matchups, standings, weeklyScores, summary, playoffWeekStart } = data;
  const { commentary, showAllPlayRecord = true, showPointsDifferential = true } = options;

  const isPlayoffWeek = week >= playoffWeekStart;
  const weekTitle = getWeekTitle(season, week, playoffWeekStart);

  // Sort scores for rankings
  const sortedScores = [...weeklyScores].sort((a, b) => b.points.for - a.points.for);
  const top3 = sortedScores.slice(0, 3);
  const bottom3 = sortedScores.slice(-3).reverse();

  // Build report content
  const content: string[] = [];

  // Header
  content.push(`
    <div class="ledger-title">THE LEDGER</div>
    <div class="ledger-subtitle">${season} Season — ${weekTitle}</div>
  `);

  // Quick summary bar
  content.push(`
    <div class="ledger-summary">
      <div class="ledger-stat">
        <div class="ledger-stat-label">Median</div>
        <div class="ledger-stat-value">${formatPoints(summary.median)}</div>
      </div>
      <div class="ledger-stat">
        <div class="ledger-stat-label">High</div>
        <div class="ledger-stat-value">${formatPoints(summary.highest)}</div>
        <div class="ledger-stat-detail">${summary.topScorer}</div>
      </div>
      <div class="ledger-stat">
        <div class="ledger-stat-label">Low</div>
        <div class="ledger-stat-value">${formatPoints(summary.lowest)}</div>
        <div class="ledger-stat-detail">${summary.bottomScorer}</div>
      </div>
      <div class="ledger-stat">
        <div class="ledger-stat-label">Spread</div>
        <div class="ledger-stat-value">${formatPoints(summary.highest - summary.lowest)}</div>
      </div>
      <div class="ledger-stat">
        <div class="ledger-stat-label">Avg Margin</div>
        <div class="ledger-stat-value">${formatPoints(matchups.reduce((sum, m) => sum + m.pointDifferential, 0) / matchups.length)}</div>
      </div>
    </div>
  `);

  // Brief opener (if commentary provided)
  if (commentary?.opener) {
    content.push(`<div class="ledger-note">${commentary.opener}</div>`);
  }

  // Matchups Section
  content.push(`
    <div class="ledger-section">
      <div class="ledger-section-title">Matchup Results</div>
      <div class="ledger-matchups">
        ${matchups.map(m => {
          const isTeam1Winner = m.winner.managerId === m.team1.managerId;
          const winner = isTeam1Winner ? m.team1 : m.team2;
          const loser = isTeam1Winner ? m.team2 : m.team1;

          return `
            <div class="ledger-matchup">
              <div class="ledger-matchup-header">${m.matchupType || 'Matchup'}</div>
              <div class="ledger-matchup-row ledger-matchup-winner">
                <span>${winner.name}</span>
                <span class="ledger-matchup-score">${formatPoints(winner.points)}</span>
              </div>
              <div class="ledger-matchup-row ledger-matchup-loser">
                <span>${loser.name}</span>
                <span class="ledger-matchup-score">${formatPoints(loser.points)}</span>
              </div>
              <div class="ledger-matchup-margin">Margin: ${formatPoints(m.pointDifferential)}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `);

  // Weekly Rankings Table
  content.push(`
    <div class="ledger-section">
      <div class="ledger-section-title">Weekly Rankings</div>
      <table class="ledger-table">
        <thead>
          <tr>
            <th class="rank">#</th>
            <th>Manager</th>
            <th class="numeric">Points</th>
            <th class="numeric">vs Opp</th>
            <th>H2H</th>
            <th>Med</th>
            ${showAllPlayRecord ? '<th class="numeric">All-Play</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${sortedScores.map((s, i) => `
            <tr class="${i < 3 ? 'highlight' : ''}">
              <td class="rank">${i + 1}</td>
              <td>${s.managerName}</td>
              <td class="numeric">${formatPoints(s.points.for)}</td>
              <td class="numeric">${s.points.against > 0 ? formatPoints(s.points.for - s.points.against) : '-'}</td>
              <td>${s.results.h2hWin ? '✓' : '✗'}</td>
              <td>${s.results.medianWin ? '✓' : '✗'}</td>
              ${showAllPlayRecord ? `<td class="numeric">${s.results.allPlayWins}-${s.results.allPlayLosses}</td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `);

  // Awards - Compact
  content.push(`
    <div class="ledger-section">
      <div class="ledger-section-title">Weekly Awards</div>
      <div class="ledger-awards">
        ${top3.map((s, i) => `
          <div class="ledger-award">
            <div class="ledger-award-icon">${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
            <div class="ledger-award-title">${i === 0 ? 'Top Scorer' : `#${i + 1} Scorer`}</div>
            <div class="ledger-award-winner">${s.managerName}</div>
            <div class="ledger-award-stat">${formatPoints(s.points.for)} pts</div>
          </div>
        `).join('')}
      </div>
      <div class="ledger-awards">
        ${bottom3.map((s, i) => `
          <div class="ledger-award">
            <div class="ledger-award-icon">${i === 2 ? '🚽' : '📉'}</div>
            <div class="ledger-award-title">${i === 2 ? 'Bottom' : `#${10 - i} Scorer`}</div>
            <div class="ledger-award-winner">${s.managerName}</div>
            <div class="ledger-award-stat">${formatPoints(s.points.for)} pts</div>
          </div>
        `).join('')}
      </div>
    </div>
  `);

  // Standings Table
  content.push(`
    <div class="ledger-section">
      <div class="ledger-section-title">Current Standings</div>
      <table class="ledger-table">
        <thead>
          <tr>
            <th class="rank">#</th>
            <th>Manager</th>
            <th>Combined</th>
            <th>H2H</th>
            <th>Median</th>
            ${showAllPlayRecord ? '<th>All-Play</th>' : ''}
            <th class="numeric">PF</th>
            ${showPointsDifferential ? '<th class="numeric">+/-</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${standings.map((s, i) => `
            <tr class="${i < 6 ? 'highlight' : ''}">
              <td class="rank">${s.rank}</td>
              <td>${s.displayName}</td>
              <td>${formatRecord(s.record.combined.wins, s.record.combined.losses)}</td>
              <td>${formatRecord(s.record.h2h.wins, s.record.h2h.losses)}</td>
              <td>${formatRecord(s.record.median.wins, s.record.median.losses)}</td>
              ${showAllPlayRecord ? `<td>${formatRecord(s.record.allPlay.wins, s.record.allPlay.losses)}</td>` : ''}
              <td class="numeric">${formatPoints(s.points.for)}</td>
              ${showPointsDifferential ? `<td class="numeric">${formatPoints(s.points.for - s.points.against)}</td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `);

  // Playoff Picture (if applicable)
  if (!isPlayoffWeek && week >= 8) {
    const playoffTeams = standings.slice(0, 6);
    const bubbleTeams = standings.slice(5, 8);

    content.push(`
      <div class="ledger-section">
        <div class="ledger-section-title">Playoff Picture</div>
        <table class="ledger-table">
          <thead>
            <tr>
              <th>Seed</th>
              <th>Manager</th>
              <th>Record</th>
              <th class="numeric">PF</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${playoffTeams.map((s, i) => `
              <tr class="highlight">
                <td class="rank">#${i + 1}</td>
                <td>${s.displayName}</td>
                <td>${formatRecord(s.record.combined.wins, s.record.combined.losses)}</td>
                <td class="numeric">${formatPoints(s.points.for)}</td>
                <td>${i < 2 ? '🏖️ Bye' : '✓ In'}</td>
              </tr>
            `).join('')}
            ${bubbleTeams.map((s, i) => `
              <tr>
                <td class="rank">#${i + 6}</td>
                <td>${s.displayName}</td>
                <td>${formatRecord(s.record.combined.wins, s.record.combined.losses)}</td>
                <td class="numeric">${formatPoints(s.points.for)}</td>
                <td>⚠️ Bubble</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `);
  }

  // Brief standings note (if commentary provided)
  if (commentary?.standingsAnalysis) {
    content.push(`<div class="ledger-note">${commentary.standingsAnalysis}</div>`);
  }

  // Footer
  content.push(`
    <div class="ledger-footer">
      The Ledger — ${season} Week ${week} — Generated ${new Date().toLocaleDateString()}
    </div>
  `);

  // Combine with ledger-specific styles
  const fullContent = `
    <style>${ledgerStyles}</style>
    <div class="ledger-container">
      ${content.join('\n')}
    </div>
  `;

  return generateHtmlDocument(
    `The Ledger — ${season} Week ${week}`,
    fullContent,
    { includeFooter: false }
  );
}

// Export types for API use
export type { LedgerReportData, LedgerReportOptions, MatchupData, StandingsEntry, WeeklyScore };
