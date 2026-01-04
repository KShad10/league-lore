// Postseason Report Generator
// Creates Cob Chronicles postseason recap reports

import { generateHtmlDocument, html } from './html-generator';
import { signaturePhrases } from './theme';

// Types
interface TeamInfo {
  managerId: string;
  name: string;
  seed: number;
  points: number;
  isWinner: boolean;
}

interface PostseasonMatchup {
  id: string;
  week: number;
  matchupType: string;
  bracketType: 'playoff' | 'toilet_bowl' | 'place_game';
  team1: TeamInfo;
  team2: TeamInfo;
  pointDifferential: number;
  winnerName: string;
  winnerSeed: number;
}

interface Seeding {
  seed: number;
  managerId: string;
  name: string;
  combinedWins: number;
  pointsFor: number;
  bracket: 'playoff' | 'toilet_bowl';
  hasBye: boolean;
}

interface PostseasonSummary {
  champion: string | null;
  championSeed: number;
  runnerUp: string | null;
  runnerUpSeed: number;
  thirdPlace: string | null;
  thirdPlaceSeed: number;
  toiletBowlLoser: string | null;
  toiletBowlLoserSeed: number;
}

interface BracketRound {
  name: string;
  week: number;
  matchups: PostseasonMatchup[];
  byes?: Array<{ seed: number; name: string; managerId: string }>;
}

interface PostseasonReportData {
  season: number;
  settings: {
    playoffWeekStart: number;
    playoffTeams: number;
    totalRosters: number;
    toiletBowlTeams: number;
  };
  seedings: Seeding[];
  summary: PostseasonSummary;
  playoff: { rounds: Record<string, BracketRound> };
  placeGames: { rounds: Record<string, BracketRound> };
  toiletBowl: { rounds: Record<string, BracketRound> };
  isComplete: boolean;
}

// Helper to get random phrase
function getRandomPhrase(phrases: string[]): string {
  return phrases[Math.floor(Math.random() * phrases.length)];
}

// Format matchup for display
function formatMatchupCard(m: PostseasonMatchup, cardClass: string = ''): string {
  return html.matchupCard({
    type: m.matchupType,
    week: m.week,
    team1: {
      name: m.team1.name,
      seed: m.team1.seed,
      score: m.team1.points,
      isWinner: m.team1.isWinner,
    },
    team2: {
      name: m.team2.name,
      seed: m.team2.seed,
      score: m.team2.points,
      isWinner: m.team2.isWinner,
    },
    margin: m.pointDifferential,
    cardClass,
  });
}

// Generate championship banner
function generateChampionshipBanner(summary: PostseasonSummary, season: number): string {
  if (!summary.champion) return '';
  
  return `
    <div style="text-align: center; margin: 2rem 0; padding: 2rem; background: linear-gradient(135deg, #d4af37 0%, #f5e6d3 50%, #d4af37 100%); border: 4px solid #2d5016; border-radius: 12px;">
      <div style="font-size: 3rem; margin-bottom: 0.5rem;">🏆</div>
      <div style="font-size: 1.5rem; color: #2d5016; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.5rem;">
        ${season} Champion
      </div>
      <div style="font-size: 2.5rem; color: #2d5016; font-weight: bold;">
        ${summary.champion}
      </div>
      <div style="font-size: 1rem; color: #555; margin-top: 0.5rem;">
        #${summary.championSeed} Seed
      </div>
    </div>
  `;
}

// Generate final standings table
function generateFinalStandings(summary: PostseasonSummary, seedings: Seeding[]): string {
  const finalOrder: Array<{ place: string; name: string; seed: number; badge: string }> = [];
  
  if (summary.champion) {
    finalOrder.push({ place: '1st', name: summary.champion, seed: summary.championSeed, badge: 'gold' });
  }
  if (summary.runnerUp) {
    finalOrder.push({ place: '2nd', name: summary.runnerUp, seed: summary.runnerUpSeed, badge: 'silver' });
  }
  if (summary.thirdPlace) {
    finalOrder.push({ place: '3rd', name: summary.thirdPlace, seed: summary.thirdPlaceSeed, badge: 'bronze' });
  }
  
  // Add remaining playoff teams (4th-6th estimated)
  const playoffNames = [summary.champion, summary.runnerUp, summary.thirdPlace].filter(Boolean);
  const remainingPlayoff = seedings
    .filter(s => s.bracket === 'playoff' && !playoffNames.includes(s.name))
    .sort((a, b) => a.seed - b.seed);
  
  remainingPlayoff.forEach((s, i) => {
    finalOrder.push({ place: `${4 + i}th`, name: s.name, seed: s.seed, badge: 'green' });
  });
  
  // Add toilet bowl teams
  const toiletTeams = seedings.filter(s => s.bracket === 'toilet_bowl').sort((a, b) => a.seed - b.seed);
  toiletTeams.forEach((s, i) => {
    const isLoser = summary.toiletBowlLoser === s.name;
    finalOrder.push({ 
      place: `${7 + i}th${isLoser ? ' 🚽' : ''}`, 
      name: s.name, 
      seed: s.seed, 
      badge: isLoser ? 'toilet' : 'rust'
    });
  });
  
  return html.table(
    ['Place', 'Manager', 'Seed'],
    finalOrder.map(f => [
      `${html.badge(f.place, f.badge as 'gold' | 'silver' | 'bronze' | 'toilet' | 'green' | 'rust')}`,
      f.name,
      `#${f.seed}`,
    ])
  );
}

// Main generator function
export function generatePostseasonReport(data: PostseasonReportData): string {
  const { season, settings, seedings, summary, playoff, placeGames, toiletBowl, isComplete } = data;
  
  const sections: string[] = [];
  
  // Header
  sections.push(html.title('The Cob Chronicles'));
  sections.push(html.subtitle(`${season} Postseason ${isComplete ? 'Recap' : 'Update'}`));
  
  // Opening
  sections.push(html.paragraph(getRandomPhrase(signaturePhrases.openers)));
  
  // Championship Banner (if complete)
  if (isComplete && summary.champion) {
    sections.push(generateChampionshipBanner(summary, season));
    
    sections.push(html.callout(
      `After ${settings.playoffTeams} teams battled through the bracket, ${summary.champion} stands alone as the ${season} champion.`
    ));
  }
  
  // Postseason Overview
  sections.push(html.section('Postseason Overview', html.statGrid([
    { 
      label: 'Champion', 
      value: summary.champion || 'TBD', 
      detail: summary.champion ? `#${summary.championSeed} Seed` : undefined,
      color: 'gold'
    },
    { 
      label: 'Runner-Up', 
      value: summary.runnerUp || 'TBD',
      detail: summary.runnerUp ? `#${summary.runnerUpSeed} Seed` : undefined,
    },
    { 
      label: 'Third Place', 
      value: summary.thirdPlace || 'TBD',
      detail: summary.thirdPlace ? `#${summary.thirdPlaceSeed} Seed` : undefined,
    },
    { 
      label: 'Last Place', 
      value: summary.toiletBowlLoser || 'TBD',
      detail: summary.toiletBowlLoser ? `#${summary.toiletBowlLoserSeed} Seed 🚽` : undefined,
      color: 'rust'
    },
  ])));
  
  // Seedings
  sections.push(html.section('Playoff Seedings', `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
      <div>
        ${html.subsection('🏆 Playoff Bracket', html.table(
          ['Seed', 'Manager', 'Record', 'PF'],
          seedings
            .filter(s => s.bracket === 'playoff')
            .map(s => [
              `#${s.seed}${s.hasBye ? ' (BYE)' : ''}`,
              s.name,
              `${s.combinedWins}W`,
              s.pointsFor.toFixed(2),
            ])
        ))}
      </div>
      <div>
        ${html.subsection('🚽 Toilet Bowl', html.table(
          ['Seed', 'Manager', 'Record', 'PF'],
          seedings
            .filter(s => s.bracket === 'toilet_bowl')
            .map(s => [
              `#${s.seed}`,
              s.name,
              `${s.combinedWins}W`,
              s.pointsFor.toFixed(2),
            ])
        ))}
      </div>
    </div>
  `));
  
  // Playoff Bracket
  const playoffRounds = Object.entries(playoff.rounds).sort(([a], [b]) => parseInt(a) - parseInt(b));
  if (playoffRounds.length > 0) {
    sections.push(html.section('Playoff Bracket', playoffRounds.map(([weekKey, round]) => {
      let content = html.subsection(`${round.name} (Week ${round.week})`, '');
      
      // Show byes if present
      if (round.byes && round.byes.length > 0) {
        content += `<p class="muted italic">Byes: ${round.byes.map(b => `#${b.seed} ${b.name}`).join(', ')}</p>`;
      }
      
      // Show matchups
      if (round.matchups.length > 0) {
        content += html.matchupGrid(round.matchups.map(m => ({
          type: m.matchupType,
          week: m.week,
          team1: { name: m.team1.name, seed: m.team1.seed, score: m.team1.points, isWinner: m.team1.isWinner },
          team2: { name: m.team2.name, seed: m.team2.seed, score: m.team2.points, isWinner: m.team2.isWinner },
          margin: m.pointDifferential,
          cardClass: 'playoff',
        })));
      }
      
      return content;
    }).join('')));
  }
  
  // Place Games
  const placeRounds = Object.entries(placeGames.rounds).sort(([a], [b]) => parseInt(a) - parseInt(b));
  if (placeRounds.length > 0) {
    sections.push(html.section('Place Games', placeRounds.map(([weekKey, round]) => {
      return html.subsection(`${round.name} (Week ${round.week})`, 
        html.matchupGrid(round.matchups.map(m => ({
          type: m.matchupType,
          week: m.week,
          team1: { name: m.team1.name, seed: m.team1.seed, score: m.team1.points, isWinner: m.team1.isWinner },
          team2: { name: m.team2.name, seed: m.team2.seed, score: m.team2.points, isWinner: m.team2.isWinner },
          margin: m.pointDifferential,
          cardClass: '',
        })))
      );
    }).join('')));
  }
  
  // Toilet Bowl
  const toiletRounds = Object.entries(toiletBowl.rounds).sort(([a], [b]) => parseInt(a) - parseInt(b));
  if (toiletRounds.length > 0) {
    sections.push(html.section('🚽 Toilet Bowl', `
      ${html.highlightBox('In the Toilet Bowl, the LOSER advances. The ultimate loser faces league punishment.')}
      ${toiletRounds.map(([weekKey, round]) => {
        return html.subsection(`${round.name} (Week ${round.week})`, 
          html.matchupGrid(round.matchups.map(m => ({
            type: m.matchupType,
            week: m.week,
            team1: { name: m.team1.name, seed: m.team1.seed, score: m.team1.points, isWinner: m.team1.isWinner },
            team2: { name: m.team2.name, seed: m.team2.seed, score: m.team2.points, isWinner: m.team2.isWinner },
            margin: m.pointDifferential,
            cardClass: 'toilet',
          })))
        );
      }).join('')}
    `));
  }
  
  // Final Standings (if complete)
  if (isComplete) {
    sections.push(html.pageBreak());
    sections.push(html.section('Final Standings', generateFinalStandings(summary, seedings)));
    
    // Punishment note
    if (summary.toiletBowlLoser) {
      sections.push(html.callout(
        `${summary.toiletBowlLoser} has earned the dubious honor of last place and must face the league punishment. 🚽`
      ));
    }
  }
  
  // Closing
  sections.push(html.paragraph(getRandomPhrase(signaturePhrases.closers)));
  
  return generateHtmlDocument(
    `The Cob Chronicles — ${season} Postseason`,
    sections.join('\n'),
    { footerText: `The Cob Chronicles — ${season} Postseason — OG Papio Dynasty League` }
  );
}

export type { PostseasonReportData, PostseasonMatchup, PostseasonSummary, Seeding, BracketRound };
