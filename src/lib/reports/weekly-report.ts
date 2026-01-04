// Weekly Report Generator
// Creates Cob Chronicles weekly recap reports from league data

import { generateHtmlDocument, html } from './html-generator';
import { signaturePhrases } from './theme';

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

// Main generator function
export function generateWeeklyReport(data: WeeklyReportData): string {
  const { season, week, matchups, standings, weeklyScores, summary, playoffWeekStart } = data;
  const isPlayoffWeek = week >= playoffWeekStart;
  
  // Sort scores for top/bottom performers
  const sortedScores = [...weeklyScores].sort((a, b) => b.points.for - a.points.for);
  const top3 = sortedScores.slice(0, 3);
  const bottom3 = sortedScores.slice(-3).reverse();
  
  // Build report sections
  const sections: string[] = [];
  
  // Header
  sections.push(html.title('The Cob Chronicles'));
  sections.push(html.subtitle(`${season} ${getWeekTitle(season, week, playoffWeekStart)}`));
  
  // Opening
  sections.push(html.paragraph(getRandomPhrase(signaturePhrases.openers)));
  
  // Week Summary Stats
  sections.push(html.section('Week at a Glance', html.statGrid([
    { label: 'Median Score', value: summary.median.toFixed(2) },
    { label: 'High Score', value: summary.highest.toFixed(2), detail: summary.topScorer, color: 'gold' },
    { label: 'Low Score', value: summary.lowest.toFixed(2), detail: summary.bottomScorer, color: 'rust' },
    { label: 'Avg Margin', value: (matchups.reduce((sum, m) => sum + m.pointDifferential, 0) / matchups.length).toFixed(2) },
  ])));
  
  // Matchups Section
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
  
  sections.push(html.section('Matchup Results', html.matchupGrid(matchupCards)));
  
  // Transition
  sections.push(html.paragraph(getRandomPhrase(signaturePhrases.transitions)));
  
  // Top Performers
  sections.push(html.section('Top Performers', `
    ${top3.map((s, i) => html.awardCard({
      icon: i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉',
      title: i === 0 ? 'Week Winner' : `#${i + 1} Scorer`,
      winner: s.managerName,
      stat: `${s.points.for.toFixed(2)} pts — ${s.results.allPlayWins}-${s.results.allPlayLosses} All-Play`,
    })).join('')}
  `));
  
  // Bottom Performers
  sections.push(html.subsection('Struggles of the Week', `
    ${bottom3.map((s, i) => html.awardCard({
      icon: i === 2 ? '🚽' : '😬',
      title: i === 2 ? 'Rock Bottom' : `Bottom ${3 - i}`,
      winner: s.managerName,
      stat: `${s.points.for.toFixed(2)} pts — ${s.results.allPlayWins}-${s.results.allPlayLosses} All-Play`,
    })).join('')}
  `));
  
  // Standings Table
  const standingsRows = standings.map(s => [
    s.rank.toString(),
    s.displayName,
    formatRecord(s.record.combined),
    formatRecord(s.record.h2h),
    formatRecord(s.record.median),
    s.points.for.toFixed(2),
  ]);
  
  sections.push(html.section('Current Standings', html.table(
    ['Rank', 'Manager', 'Combined', 'H2H', 'Median', 'Points For'],
    standingsRows,
    { highlightRows: [0, 1, 2, 3, 4, 5].filter(i => i < playoffWeekStart - 1 ? i < 6 : false) }
  )));
  
  // Playoff Picture (if regular season)
  if (!isPlayoffWeek && week >= 8) {
    const playoffTeams = standings.slice(0, 6);
    const bubbleTeams = standings.slice(5, 8);
    
    sections.push(html.section('Playoff Picture', `
      ${html.subsection('Clinched / Projected', `
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
      `)}
      ${bubbleTeams.length > 0 ? html.subsection('On the Bubble', `
        ${html.table(
          ['Position', 'Manager', 'Record', 'Points For'],
          bubbleTeams.map((s, i) => [
            `#${i + 6}`,
            s.displayName,
            formatRecord(s.record.combined),
            s.points.for.toFixed(2),
          ])
        )}
      `) : ''}
    `));
  }
  
  // Callout
  const biggestWin = matchups.reduce((max, m) => m.pointDifferential > max.pointDifferential ? m : max, matchups[0]);
  const closestGame = matchups.reduce((min, m) => m.pointDifferential < min.pointDifferential ? m : min, matchups[0]);
  
  sections.push(html.callout(
    `Biggest blowout: ${biggestWin.winner.name} dominated by ${biggestWin.pointDifferential.toFixed(2)} points.`
  ));
  
  if (closestGame.pointDifferential < 10) {
    sections.push(html.highlightBox(
      `Closest call of the week: ${closestGame.winner.name} escaped with a ${closestGame.pointDifferential.toFixed(2)}-point victory. ${classifyMatchup(closestGame.pointDifferential).emoji}`
    ));
  }
  
  // Closing
  sections.push(html.paragraph(getRandomPhrase(signaturePhrases.closers)));
  
  return generateHtmlDocument(
    `The Cob Chronicles — ${season} Week ${week}`,
    sections.join('\n'),
    { footerText: `The Cob Chronicles — ${season} Week ${week} — OG Papio Dynasty League` }
  );
}

// Export types for API use
export type { WeeklyReportData, MatchupData, StandingsEntry, WeeklyScore };
