// Weekly Report Generator
// Creates Cob Chronicles weekly recap reports from league data

import { generateHtmlDocument, html } from './html-generator';
import { signaturePhrases } from './theme';
import { WeeklyCommentary } from '@/lib/ai';

// Types
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

interface WeeklyReportData {
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

// Sections configuration
interface SectionConfig {
  enabled: boolean;
}

interface ReportSections {
  standings?: SectionConfig;
  matchups?: SectionConfig;
  awards?: SectionConfig;
  powerRankings?: SectionConfig;
  transactions?: SectionConfig;
  injuries?: SectionConfig;
  playoffPicture?: SectionConfig;
}

interface ReportOptions {
  sections?: ReportSections;
  commentary?: WeeklyCommentary;
}

// Default sections (backwards compatible)
const DEFAULT_SECTIONS: ReportSections = {
  standings: { enabled: true },
  matchups: { enabled: true },
  awards: { enabled: true },
  powerRankings: { enabled: false },
  transactions: { enabled: false },
  injuries: { enabled: false },
  playoffPicture: { enabled: true },
};

// Helper functions
function getRandomPhrase(phrases: string[]): string {
  return phrases[Math.floor(Math.random() * phrases.length)];
}

function formatRecord(record: { wins: number; losses: number }): string {
  return `${record.wins}-${record.losses}`;
}

function getWeekTitle(season: number, week: number, playoffWeekStart: number): string {
  if (week >= playoffWeekStart) {
    const playoffWeek = week - playoffWeekStart + 1;
    if (playoffWeek === 1) return `Playoff Week 1 — Wildcard Round`;
    if (playoffWeek === 2) return `Playoff Week 2 — Semifinals`;
    if (playoffWeek === 3) return `Playoff Week 3 — Championship`;
    return `Playoff Week ${playoffWeek}`;
  }
  return `Week ${week}`;
}

function classifyMatchup(margin: number): { label: string; emoji: string } {
  if (margin < 5) return { label: 'Nail-Biter', emoji: '😰' };
  if (margin < 10) return { label: 'Close Game', emoji: '🤏' };
  if (margin < 20) return { label: 'Solid Win', emoji: '💪' };
  if (margin < 40) return { label: 'Comfortable', emoji: '😎' };
  return { label: 'Blowout', emoji: '💀' };
}

// Calculate power ranking score for a team
function calculatePowerScore(
  standing: StandingsEntry,
  weeklyScore: WeeklyScore | undefined,
  weekNum: number
): number {
  // Composite score based on:
  // - Combined win percentage (40%)
  // - All-play win percentage (25%)
  // - Points for rank (20%)
  // - Recent performance - this week's rank (15%)
  
  const combinedGames = standing.record.combined.wins + standing.record.combined.losses;
  const combinedWinPct = combinedGames > 0 ? standing.record.combined.wins / combinedGames : 0;
  
  const allPlayGames = standing.record.allPlay.wins + standing.record.allPlay.losses;
  const allPlayWinPct = allPlayGames > 0 ? standing.record.allPlay.wins / allPlayGames : 0;
  
  // Normalize points for to 0-1 scale (assuming max ~200 avg per week)
  const avgPointsPerWeek = weekNum > 0 ? standing.points.for / weekNum : 0;
  const pointsScore = Math.min(avgPointsPerWeek / 180, 1);
  
  // Recent performance (inverse of weekly rank, normalized)
  const weeklyRank = weeklyScore?.results.weeklyRank || 5;
  const recentScore = (10 - weeklyRank) / 9; // 0-1 scale
  
  return (combinedWinPct * 0.40) + (allPlayWinPct * 0.25) + (pointsScore * 0.20) + (recentScore * 0.15);
}

// Generate Power Rankings section
function generatePowerRankings(
  standings: StandingsEntry[],
  weeklyScores: WeeklyScore[],
  week: number,
  commentary?: string
): string {
  // Create weekly score lookup by manager name
  const weeklyScoreMap = new Map(
    weeklyScores.map(s => [s.managerName, s])
  );
  
  // Calculate power scores and sort
  const powerRankings = standings.map(s => ({
    ...s,
    weeklyScore: weeklyScoreMap.get(s.displayName),
    powerScore: calculatePowerScore(s, weeklyScoreMap.get(s.displayName), week),
  })).sort((a, b) => b.powerScore - a.powerScore);
  
  // Generate tier labels
  const getTier = (index: number): string => {
    if (index < 2) return '👑 Elite';
    if (index < 4) return '⚡ Contenders';
    if (index < 7) return '⚖️ Middle Pack';
    return '🔻 Struggling';
  };
  
  // Build rankings table rows
  const rows = powerRankings.map((team, i) => {
    const standingChange = team.rank - (i + 1);
    const trend = standingChange > 0 ? `↑${standingChange}` : standingChange < 0 ? `↓${Math.abs(standingChange)}` : '—';
    const trendClass = standingChange > 0 ? 'green' : standingChange < 0 ? 'rust' : 'muted';
    
    return [
      `#${i + 1}`,
      team.displayName,
      formatRecord(team.record.combined),
      team.points.for.toFixed(2),
      (team.powerScore * 100).toFixed(1),
      `<span class="${trendClass}">${trend}</span>`,
    ];
  });
  
  // Group by tiers for display
  let content = '';
  
  if (commentary) {
    content += html.paragraph(commentary);
  }
  
  content += html.table(
    ['Rank', 'Manager', 'Record', 'PF', 'Power Score', 'vs Standing'],
    rows,
    { highlightRows: [0, 1] }
  );
  
  // Add tier breakdown
  const tierBreakdown = `
    <div class="stat-grid" style="margin-top: 1rem;">
      <div class="stat-box">
        <div class="stat-label">👑 Elite Tier</div>
        <div class="stat-value" style="font-size: 1rem;">${powerRankings.slice(0, 2).map(t => t.displayName).join(', ')}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">⚡ Contender Tier</div>
        <div class="stat-value" style="font-size: 1rem;">${powerRankings.slice(2, 4).map(t => t.displayName).join(', ')}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">⚖️ Middle Pack</div>
        <div class="stat-value" style="font-size: 1rem;">${powerRankings.slice(4, 7).map(t => t.displayName).join(', ')}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">🔻 Struggling</div>
        <div class="stat-value" style="font-size: 1rem;">${powerRankings.slice(7).map(t => t.displayName).join(', ')}</div>
      </div>
    </div>
  `;
  
  content += tierBreakdown;
  
  return html.section('Power Rankings', content);
}

// Main generator function
export function generateWeeklyReport(data: WeeklyReportData, options: ReportOptions = {}): string {
  const { season, week, matchups, standings, weeklyScores, summary, playoffWeekStart } = data;
  const sections = { ...DEFAULT_SECTIONS, ...options.sections };
  const commentary = options.commentary;
  const isPlayoffWeek = week >= playoffWeekStart;
  
  // Sort scores for top/bottom performers
  const sortedScores = [...weeklyScores].sort((a, b) => b.points.for - a.points.for);
  const top3 = sortedScores.slice(0, 3);
  const bottom3 = sortedScores.slice(-3).reverse();
  
  // Build report sections
  const reportSections: string[] = [];
  
  // Header
  reportSections.push(html.title('The Cob Chronicles'));
  reportSections.push(html.subtitle(`${season} ${getWeekTitle(season, week, playoffWeekStart)}`));
  
  // Opening - use AI commentary if available
  const opener = commentary?.opener || getRandomPhrase(signaturePhrases.openers);
  reportSections.push(html.paragraph(opener));
  
  // Week Summary Stats
  reportSections.push(html.section('Week at a Glance', html.statGrid([
    { label: 'Median Score', value: summary.median.toFixed(2) },
    { label: 'High Score', value: summary.highest.toFixed(2), detail: summary.topScorer, color: 'gold' },
    { label: 'Low Score', value: summary.lowest.toFixed(2), detail: summary.bottomScorer, color: 'rust' },
    { label: 'Avg Margin', value: (matchups.reduce((sum, m) => sum + m.pointDifferential, 0) / matchups.length).toFixed(2) },
  ])));
  
  // Matchups Section
  if (sections.matchups?.enabled) {
    const matchupCards = matchups.map(m => ({
      type: m.matchupType || classifyMatchup(m.pointDifferential).label,
      week: m.week,
      team1: {
        name: m.team1.name,
        score: m.team1.points,
        isWinner: m.winner.managerId === m.team1.managerId,
      },
      team2: {
        name: m.team2.name,
        score: m.team2.points,
        isWinner: m.winner.managerId === m.team2.managerId,
      },
      margin: m.pointDifferential,
      cardClass: m.isPlayoff ? 'playoff' : '',
    }));
    
    reportSections.push(html.section('Matchup Results', html.matchupGrid(matchupCards)));
  }
  
  // Transition
  reportSections.push(html.paragraph(getRandomPhrase(signaturePhrases.transitions)));
  
  // Awards Section (Top/Bottom Performers)
  if (sections.awards?.enabled) {
    // Top Performers - use AI spotlight if available
    let topPerformerContent = top3.map((s, i) => html.awardCard({
      icon: i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉',
      title: i === 0 ? 'Week Winner' : `#${i + 1} Scorer`,
      winner: s.managerName,
      stat: `${s.points.for.toFixed(2)} pts — ${s.results.allPlayWins}-${s.results.allPlayLosses} All-Play`,
    })).join('');
    
    if (commentary?.topPerformerSpotlight) {
      topPerformerContent = html.paragraph(commentary.topPerformerSpotlight) + topPerformerContent;
    }
    
    reportSections.push(html.section('Top Performers', topPerformerContent));
    
    // Bottom Performers - use AI roast if available
    let bottomPerformerContent = bottom3.map((s, i) => html.awardCard({
      icon: i === 2 ? '🚽' : '😬',
      title: i === 2 ? 'Rock Bottom' : `Bottom ${3 - i}`,
      winner: s.managerName,
      stat: `${s.points.for.toFixed(2)} pts — ${s.results.allPlayWins}-${s.results.allPlayLosses} All-Play`,
    })).join('');
    
    if (commentary?.bottomPerformerRoast) {
      bottomPerformerContent = html.paragraph(commentary.bottomPerformerRoast) + bottomPerformerContent;
    }
    
    reportSections.push(html.subsection('Struggles of the Week', bottomPerformerContent));
  }
  
  // Standings Section
  if (sections.standings?.enabled) {
    const standingsRows = standings.map(s => [
      s.rank.toString(),
      s.displayName,
      formatRecord(s.record.combined),
      formatRecord(s.record.h2h),
      formatRecord(s.record.median),
      s.points.for.toFixed(2),
    ]);
    
    let standingsContent = html.table(
      ['Rank', 'Manager', 'Combined', 'H2H', 'Median', 'Points For'],
      standingsRows,
      { highlightRows: [0, 1, 2, 3, 4, 5].filter(i => i < playoffWeekStart - 1 ? i < 6 : false) }
    );
    
    // Add AI standings analysis if available
    if (commentary?.standingsAnalysis) {
      standingsContent = html.paragraph(commentary.standingsAnalysis) + standingsContent;
    }
    
    reportSections.push(html.section('Current Standings', standingsContent));
  }
  
  // Power Rankings Section (NEW)
  if (sections.powerRankings?.enabled) {
    reportSections.push(generatePowerRankings(standings, weeklyScores, week));
  }
  
  // Playoff Picture (if enabled AND regular season week 8+)
  if (sections.playoffPicture?.enabled && !isPlayoffWeek && week >= 8) {
    const playoffTeams = standings.slice(0, 6);
    const bubbleTeams = standings.slice(5, 8);
    
    let playoffContent = '';
    
    // Add AI playoff picture analysis if available
    if (commentary?.playoffPicture) {
      playoffContent += html.paragraph(commentary.playoffPicture);
    }
    
    playoffContent += html.subsection('Clinched / Projected', `
      <p>Top 6 teams qualify for playoffs. Seeds 1-2 receive first-round byes.</p>
      ${html.table(
        ['Seed', 'Manager', 'Record', 'Points For'],
        playoffTeams.map((s, i) => [
          `#${i + 1}`,
          s.displayName,
          formatRecord(s.record.combined),
          s.points.for.toFixed(2),
        ])
      )}
    `);
    
    if (bubbleTeams.length > 0) {
      playoffContent += html.subsection('On the Bubble', html.table(
        ['Position', 'Manager', 'Record', 'Points For'],
        bubbleTeams.map((s, i) => [
          `#${i + 6}`,
          s.displayName,
          formatRecord(s.record.combined),
          s.points.for.toFixed(2),
        ])
      ));
    }
    
    reportSections.push(html.section('Playoff Picture', playoffContent));
  }
  
  // Callouts
  const biggestWin = matchups.reduce((max, m) => m.pointDifferential > max.pointDifferential ? m : max, matchups[0]);
  const closestGame = matchups.reduce((min, m) => m.pointDifferential < min.pointDifferential ? m : min, matchups[0]);
  
  reportSections.push(html.callout(
    `Biggest blowout: ${biggestWin.winner.name} dominated by ${biggestWin.pointDifferential.toFixed(2)} points.`
  ));
  
  if (closestGame.pointDifferential < 10) {
    reportSections.push(html.highlightBox(
      `Closest call of the week: ${closestGame.winner.name} escaped with a ${closestGame.pointDifferential.toFixed(2)}-point victory. ${classifyMatchup(closestGame.pointDifferential).emoji}`
    ));
  }
  
  // Closing - use AI closer if available
  const closer = commentary?.closer || getRandomPhrase(signaturePhrases.closers);
  reportSections.push(html.paragraph(closer));
  
  return generateHtmlDocument(
    `The Cob Chronicles — ${season} Week ${week}`,
    reportSections.join('\n'),
    { footerText: `The Cob Chronicles — ${season} Week ${week} — OG Papio Dynasty League` }
  );
}

// Export types for API use
export type { WeeklyReportData, MatchupData, StandingsEntry, WeeklyScore, ReportSections, ReportOptions };
