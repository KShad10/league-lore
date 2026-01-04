// Voice Presets & Report Template Prompts
// For generating League Lore commentary

// ═══════════════════════════════════════════════════════════════════════════
// VOICE PRESETS
// ═══════════════════════════════════════════════════════════════════════════

export type VoicePreset = 'supreme_leader' | 'professional' | 'casual' | 'custom';

export interface VoiceConfig {
  id: VoicePreset;
  name: string;
  description: string;
  systemPrompt: string;
}

export const VOICE_PRESETS: Record<VoicePreset, VoiceConfig> = {
  supreme_leader: {
    id: 'supreme_leader',
    name: 'Supreme Leader',
    description: 'Aggressive sarcasm, hyperbolic roasting, dramatic emphasis',
    systemPrompt: `You are Supreme Leader SHADdam Hussein, the omniscient and sardonic commissioner of this dynasty fantasy football league. You write analytical reports that blend sharp statistical analysis with witty, sometimes absurdist commentary.

## Your Voice & Style

**Tone:** 60% statistical analysis, 30% comedy, 10% meta-commentary. You're knowledgeable but never boring. You find humor in the absurdity of grown adults obsessing over fantasy football.

**Signature Elements:**
- Use em-dashes (—) liberally for asides and emphasis
- Dramatic declarations about obvious things
- Mock grandiosity when describing mundane fantasy events
- Gentle roasting that never crosses into cruelty
- Occasional references to "word on the street" or insider knowledge
- "The numbers don't lie — but they do occasionally embellish."

**Writing Guidelines:**
- Vary sentence length: mix punchy statements with longer analytical passages
- Reference specific statistics to ground your commentary
- Occasional pop culture references are welcome
- Never be mean-spirited — roast gently, celebrate genuinely
- Maintain an air of benevolent omniscience

**What to Avoid:**
- Excessive exclamation points
- Generic fantasy football clichés without a twist
- Being boring or overly formal
- Bullet points (write in prose paragraphs)
- Emojis`,
  },

  professional: {
    id: 'professional',
    name: 'Professional Analyst',
    description: 'ESPN-style neutral, data-driven, measured analysis',
    systemPrompt: `You are a professional fantasy football analyst providing measured, insightful commentary for a dynasty league report. Your style mirrors ESPN or NFL Network analysts — authoritative, balanced, and focused on actionable insights.

## Your Voice & Style

**Tone:** 80% statistical analysis, 15% strategic insight, 5% measured praise/criticism. You respect the competition while providing honest assessment.

**Signature Elements:**
- Lead with key statistics and metrics
- Contextualize performance within season trends
- Use comparative analysis (vs. league average, vs. previous weeks)
- Acknowledge both strong and weak performances objectively
- Project forward implications for playoffs and standings

**Writing Guidelines:**
- Clear, direct sentences without unnecessary embellishment
- Every claim backed by data
- Professional vocabulary without jargon overload
- Balanced coverage — don't dwell too long on any single manager
- Acknowledge uncertainty where appropriate

**What to Avoid:**
- Excessive enthusiasm or negativity
- Personal attacks or mockery
- Speculation without basis
- Overly casual language or slang
- Hot takes without supporting evidence`,
  },

  casual: {
    id: 'casual',
    name: 'Casual Friend',
    description: 'Conversational, light trash talk, encouraging',
    systemPrompt: `You're writing a fantasy football recap for your friend group's league — the kind you'd post in a group chat or Slack channel. Keep it fun, conversational, and like you're talking to buddies at a bar.

## Your Voice & Style

**Tone:** 50% friendly banter, 30% light analysis, 20% hype and encouragement. You're here to have fun and keep the league engaged.

**Signature Elements:**
- Casual, conversational language
- Light trash talk (the kind that makes people laugh, not angry)
- Celebrate big wins enthusiastically
- Console bad weeks with humor
- Inside jokes welcome (reference past performances, rivalries)
- "Man, what a week!"

**Writing Guidelines:**
- Short, punchy sentences
- Use contractions freely (you're, it's, that's)
- React to things like a real person would
- Ask rhetorical questions to engage readers
- Keep it light even when discussing losses

**What to Avoid:**
- Being mean or making anyone feel bad
- Overly formal analysis
- Long paragraphs of dense statistics
- Boring, dry recaps
- Taking anything too seriously`,
  },

  custom: {
    id: 'custom',
    name: 'Custom Voice',
    description: 'User-defined personality and tone',
    systemPrompt: '', // Populated by user input
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// REPORT TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

export type ReportTemplate = 'chronicle' | 'ledger' | 'standard';

export interface TemplateConfig {
  id: ReportTemplate;
  name: string;
  description: string;
  narrativeLength: 'long' | 'medium' | 'short';
  wordCounts: {
    opener: [number, number]; // [min, max]
    matchup: [number, number];
    standings: [number, number];
    spotlight: [number, number];
    closer: [number, number];
  };
  includeDetailedTables: boolean;
  emphasisOnProse: boolean;
}

export const REPORT_TEMPLATES: Record<ReportTemplate, TemplateConfig> = {
  chronicle: {
    id: 'chronicle',
    name: 'The Chronicle',
    description: 'Commentary-heavy with rich narratives (400-600 word sections)',
    narrativeLength: 'long',
    wordCounts: {
      opener: [150, 250],
      matchup: [80, 120],
      standings: [200, 300],
      spotlight: [100, 150],
      closer: [100, 150],
    },
    includeDetailedTables: false,
    emphasisOnProse: true,
  },

  ledger: {
    id: 'ledger',
    name: 'The Ledger',
    description: 'Stats-heavy with minimal prose, focus on tables and data',
    narrativeLength: 'short',
    wordCounts: {
      opener: [40, 80],
      matchup: [20, 40],
      standings: [60, 100],
      spotlight: [30, 50],
      closer: [30, 50],
    },
    includeDetailedTables: true,
    emphasisOnProse: false,
  },

  standard: {
    id: 'standard',
    name: 'The Standard',
    description: 'Balanced approach with moderate narratives and tables',
    narrativeLength: 'medium',
    wordCounts: {
      opener: [80, 150],
      matchup: [40, 70],
      standings: [120, 180],
      spotlight: [60, 90],
      closer: [60, 90],
    },
    includeDetailedTables: true,
    emphasisOnProse: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// LEAGUE CONTEXT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export interface LeagueContext {
  leagueName: string;
  format: string; // e.g., "SuperFlex, 0.5 TE Premium"
  scoringType: string; // e.g., "H2H + Median (dual scoring)"
  playoffFormat: string;
  managers?: Array<{
    username: string;
    displayName?: string;
    nickname?: string;
    contextNotes?: string;
  }>;
}

export function buildLeagueContextPrompt(context: LeagueContext): string {
  let prompt = `## League Context

- **League:** ${context.leagueName}
- **Format:** ${context.format}
- **Scoring:** ${context.scoringType}
- **Playoffs:** ${context.playoffFormat}`;

  if (context.managers && context.managers.length > 0) {
    const managersWithContext = context.managers.filter(
      (m) => m.displayName || m.nickname || m.contextNotes
    );

    if (managersWithContext.length > 0) {
      prompt += `\n\n## Manager Context\n\n`;
      managersWithContext.forEach((m) => {
        const name = m.displayName || m.username;
        prompt += `**${name}**`;
        if (m.nickname) prompt += ` ("${m.nickname}")`;
        prompt += `\n`;
        if (m.contextNotes) prompt += `${m.contextNotes}\n`;
        prompt += `\n`;
      });
    }
  }

  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

export interface PromptContext {
  voice: VoicePreset;
  template: ReportTemplate;
  customVoice?: string;
  leagueContext?: LeagueContext;
}

function getWordCountInstruction(template: TemplateConfig, section: keyof TemplateConfig['wordCounts']): string {
  const [min, max] = template.wordCounts[section];
  return `Write approximately ${min}-${max} words.`;
}

function getVoiceSystemPrompt(context: PromptContext): string {
  if (context.voice === 'custom' && context.customVoice) {
    return `You are a fantasy football analyst with the following personality and style:\n\n${context.customVoice}\n\nWrite in this voice consistently throughout your commentary.`;
  }
  return VOICE_PRESETS[context.voice].systemPrompt;
}

export function buildSystemPrompt(context: PromptContext): string {
  let prompt = getVoiceSystemPrompt(context);

  if (context.leagueContext) {
    prompt += '\n\n' + buildLeagueContextPrompt(context.leagueContext);
  }

  return prompt;
}

// Prompt builders for different content types
export const PROMPTS = {
  weeklyOpener: (
    data: {
      season: number;
      week: number;
      topScorer: string;
      topScore: number;
      bottomScorer: string;
      bottomScore: number;
      biggestBlowout: number;
      closestMargin: number;
    },
    context: PromptContext
  ) => {
    const template = REPORT_TEMPLATES[context.template];
    return `Write an engaging opening for Week ${data.week} of the ${data.season} season.

Key stats to work with:
- Top scorer: ${data.topScorer} with ${data.topScore} points
- Bottom scorer: ${data.bottomScorer} with ${data.bottomScore} points  
- Biggest margin of victory: ${data.biggestBlowout} points
- Closest game margin: ${data.closestMargin} points

Set the scene for the week. What's the narrative? Was it chaos? Dominance? A week of close calls?

${getWordCountInstruction(template, 'opener')}`;
  },

  matchupCommentary: (
    data: {
      winner: string;
      winnerScore: number;
      loser: string;
      loserScore: number;
      margin: number;
      winnerRecord: string;
      loserRecord: string;
      isPlayoff?: boolean;
      matchupType?: string;
    },
    context: PromptContext
  ) => {
    const template = REPORT_TEMPLATES[context.template];
    return `Write commentary for this matchup:

${data.winner} (${data.winnerRecord}) defeated ${data.loser} (${data.loserRecord})
Score: ${data.winnerScore} - ${data.loserScore} (margin: ${data.margin})
${data.isPlayoff ? `Matchup type: ${data.matchupType}` : 'Regular season matchup'}

What's the story here? Was it expected? A blowout? A nail-biter?

${getWordCountInstruction(template, 'matchup')}`;
  },

  standingsAnalysis: (
    data: {
      season: number;
      week: number;
      playoffWeekStart: number;
      standings: Array<{
        rank: number;
        name: string;
        combinedWins: number;
        combinedLosses: number;
        pointsFor: number;
        trend?: 'up' | 'down' | 'same';
      }>;
    },
    context: PromptContext
  ) => {
    const template = REPORT_TEMPLATES[context.template];
    return `Analyze the current standings after Week ${data.week} of ${data.season}. Playoffs start Week ${data.playoffWeekStart}.

Current standings:
${data.standings.map((s) => `${s.rank}. ${s.name}: ${s.combinedWins}-${s.combinedLosses} (${s.pointsFor.toFixed(1)} PF)`).join('\n')}

Cover:
1. Who's looking strong at the top?
2. The playoff bubble situation
3. Who's struggling at the bottom?

${getWordCountInstruction(template, 'standings')}`;
  },

  topPerformerSpotlight: (
    data: {
      name: string;
      score: number;
      rank: number;
      allPlayRecord: string;
      previousWeekScore?: number;
      seasonAverage?: number;
    },
    context: PromptContext
  ) => {
    const template = REPORT_TEMPLATES[context.template];
    return `Write about this week's top performer:

${data.name}: ${data.score} points (Rank: #${data.rank}, All-Play: ${data.allPlayRecord})
${data.seasonAverage ? `Season average: ${data.seasonAverage.toFixed(1)}` : ''}
${data.previousWeekScore ? `Last week: ${data.previousWeekScore}` : ''}

Celebrate the performance with context.

${getWordCountInstruction(template, 'spotlight')}`;
  },

  bottomPerformerRoast: (
    data: {
      name: string;
      score: number;
      rank: number;
      allPlayRecord: string;
    },
    context: PromptContext
  ) => {
    const template = REPORT_TEMPLATES[context.template];
    return `Write about this week's lowest scorer:

${data.name}: ${data.score} points (Rank: #${data.rank}, All-Play: ${data.allPlayRecord})

Be honest but not cruel. Find the humor or offer perspective.

${getWordCountInstruction(template, 'spotlight')}`;
  },

  playoffPicture: (
    data: {
      week: number;
      weeksRemaining: number;
      playoffTeams: number;
      currentQualifiers: Array<{ rank: number; name: string; wins: number; pf: number }>;
      bubbleTeams: Array<{ rank: number; name: string; wins: number; pf: number; gamesBack: number }>;
    },
    context: PromptContext
  ) => {
    const template = REPORT_TEMPLATES[context.template];
    return `Analyze the playoff race with ${data.weeksRemaining} weeks remaining:

Currently in playoff position (top ${data.playoffTeams}):
${data.currentQualifiers.map((t) => `${t.rank}. ${t.name} (${t.wins}W, ${t.pf.toFixed(1)} PF)`).join('\n')}

On the bubble:
${data.bubbleTeams.map((t) => `${t.rank}. ${t.name} (${t.wins}W, ${t.pf.toFixed(1)} PF) - ${t.gamesBack} games back`).join('\n')}

Who's safe? Who's sweating? What scenarios are in play?

${getWordCountInstruction(template, 'standings')}`;
  },

  postseasonRecap: (
    data: {
      season: number;
      champion: string;
      championSeed: number;
      runnerUp: string;
      runnerUpSeed: number;
      thirdPlace?: string;
      toiletBowlLoser: string;
      toiletBowlLoserSeed: number;
      championshipMargin: number;
    },
    context: PromptContext
  ) => {
    const template = REPORT_TEMPLATES[context.template];
    const wordCount = template.narrativeLength === 'long' ? '300-400' : template.narrativeLength === 'medium' ? '150-250' : '80-120';
    
    return `Write a postseason recap for the ${data.season} season:

Champion: #${data.championSeed} ${data.champion}
Runner-up: #${data.runnerUpSeed} ${data.runnerUp}
Championship margin: ${data.championshipMargin} points
${data.thirdPlace ? `Third place: ${data.thirdPlace}` : ''}
Last place (Toilet Bowl loser): #${data.toiletBowlLoserSeed} ${data.toiletBowlLoser}

Cover:
1. The champion's path to glory
2. The championship game itself
3. The toilet bowl outcome
4. Looking ahead

Write approximately ${wordCount} words.`;
  },

  weeklyCloser: (
    data: {
      week: number;
      nextWeekPreview?: string;
      playoffImplications?: string;
    },
    context: PromptContext
  ) => {
    const template = REPORT_TEMPLATES[context.template];
    return `Write a closing for the Week ${data.week} report.

${data.nextWeekPreview ? `Next week preview: ${data.nextWeekPreview}` : ''}
${data.playoffImplications ? `Playoff implications: ${data.playoffImplications}` : ''}

End with something memorable — a call to action, insight, or teaser.

${getWordCountInstruction(template, 'closer')}`;
  },

  championPath: (
    data: {
      champion: string;
      championSeed: number;
      playoffMatchups: Array<{
        round: string;
        winner: string;
        winnerSeed: number;
        loser: string;
        loserSeed: number;
        margin: number;
      }>;
    },
    context: PromptContext
  ) => {
    const template = REPORT_TEMPLATES[context.template];
    const wordCount = template.narrativeLength === 'long' ? '200-300' : template.narrativeLength === 'medium' ? '100-150' : '50-80';
    
    const matchupList = data.playoffMatchups
      .map((m) => `${m.round}: beat #${m.loserSeed} ${m.loser} by ${m.margin.toFixed(1)}`)
      .join('\n');
    
    return `Write about ${data.champion}'s championship run:

${matchupList}

Tell the story of their path to the title. Write approximately ${wordCount} words.`;
  },

  toiletBowlSummary: (
    data: {
      toiletBowlLoser: string;
      toiletBowlLoserSeed: number;
    },
    context: PromptContext
  ) => {
    const template = REPORT_TEMPLATES[context.template];
    const wordCount = template.narrativeLength === 'long' ? '150-200' : template.narrativeLength === 'medium' ? '80-120' : '40-60';
    
    return `Write about the Toilet Bowl results. ${data.toiletBowlLoser} (#${data.toiletBowlLoserSeed} seed) finished last and must face the league punishment. In the Toilet Bowl, losers advance toward punishment — ${data.toiletBowlLoser} lost their way to the bottom. Make it sympathetic but humorous. Write approximately ${wordCount} words.`;
  },
};

export default PROMPTS;
