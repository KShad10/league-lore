// Commentary Generator - Uses Claude API to generate League Lore content
import { anthropic, CLAUDE_CONFIG } from './client';
import {
  VoicePreset,
  ReportTemplate,
  VOICE_PRESETS,
  REPORT_TEMPLATES,
  buildSystemPrompt,
  PROMPTS,
  PromptContext,
  LeagueContext,
} from './prompts';

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface CommentaryConfig {
  voice: VoicePreset;
  template: ReportTemplate;
  customVoice?: string;
  leagueContext?: LeagueContext;
}

// Default config
const DEFAULT_CONFIG: CommentaryConfig = {
  voice: 'supreme_leader',
  template: 'standard',
};

// Core generation function
async function generateCommentary(
  userPrompt: string,
  config: CommentaryConfig = DEFAULT_CONFIG,
  options: GenerateOptions = {}
): Promise<string> {
  const { temperature = CLAUDE_CONFIG.temperature, maxTokens = CLAUDE_CONFIG.maxTokens } = options;

  const promptContext: PromptContext = {
    voice: config.voice,
    template: config.template,
    customVoice: config.customVoice,
    leagueContext: config.leagueContext,
  };

  const systemPrompt = buildSystemPrompt(promptContext);

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_CONFIG.model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Extract text from response
    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in response');
    }

    return textBlock.text;
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}

// =============================================================================
// WEEKLY REPORT COMMENTARY
// =============================================================================

export interface WeeklyCommentaryData {
  season: number;
  week: number;
  playoffWeekStart: number;
  summary: {
    median: number;
    highest: number;
    lowest: number;
    topScorer: string;
    bottomScorer: string;
  };
  matchups: Array<{
    winner: string;
    winnerScore: number;
    loser: string;
    loserScore: number;
    margin: number;
    winnerRecord: string;
    loserRecord: string;
  }>;
  standings: Array<{
    rank: number;
    name: string;
    combinedWins: number;
    combinedLosses: number;
    pointsFor: number;
  }>;
  weeklyScores: Array<{
    name: string;
    score: number;
    rank: number;
    allPlayWins: number;
    allPlayLosses: number;
  }>;
}

export interface WeeklyCommentary {
  opener: string;
  matchupCommentaries: Record<string, string>; // keyed by "winner vs loser"
  standingsAnalysis: string;
  topPerformerSpotlight: string;
  bottomPerformerRoast: string;
  playoffPicture?: string;
  closer: string;
}

export async function generateWeeklyCommentary(
  data: WeeklyCommentaryData,
  config: CommentaryConfig = DEFAULT_CONFIG
): Promise<WeeklyCommentary> {
  const { season, week, playoffWeekStart, summary, matchups, standings, weeklyScores } = data;

  const promptContext: PromptContext = {
    voice: config.voice,
    template: config.template,
    customVoice: config.customVoice,
    leagueContext: config.leagueContext,
  };

  const templateConfig = REPORT_TEMPLATES[config.template];

  // Adjust max tokens based on template
  const getMaxTokens = (section: 'opener' | 'matchup' | 'standings' | 'spotlight' | 'closer') => {
    const [, max] = templateConfig.wordCounts[section];
    // Roughly 1.5 tokens per word
    return Math.ceil(max * 1.5) + 100;
  };

  // Find biggest blowout and closest game
  const sortedByMargin = [...matchups].sort((a, b) => b.margin - a.margin);
  const biggestBlowout = sortedByMargin[0]?.margin || 0;
  const closestMargin = sortedByMargin[sortedByMargin.length - 1]?.margin || 0;

  // Generate opener
  const opener = await generateCommentary(
    PROMPTS.weeklyOpener(
      {
        season,
        week,
        topScorer: summary.topScorer,
        topScore: summary.highest,
        bottomScorer: summary.bottomScorer,
        bottomScore: summary.lowest,
        biggestBlowout,
        closestMargin,
      },
      promptContext
    ),
    config,
    { maxTokens: getMaxTokens('opener') }
  );

  // Generate matchup commentaries
  const matchupCommentaries: Record<string, string> = {};
  for (const m of matchups) {
    const key = `${m.winner} vs ${m.loser}`;
    matchupCommentaries[key] = await generateCommentary(
      PROMPTS.matchupCommentary(
        {
          winner: m.winner,
          winnerScore: m.winnerScore,
          loser: m.loser,
          loserScore: m.loserScore,
          margin: m.margin,
          winnerRecord: m.winnerRecord,
          loserRecord: m.loserRecord,
        },
        promptContext
      ),
      config,
      { maxTokens: getMaxTokens('matchup') }
    );
  }

  // Generate standings analysis
  const standingsAnalysis = await generateCommentary(
    PROMPTS.standingsAnalysis(
      {
        season,
        week,
        playoffWeekStart,
        standings: standings.map((s) => ({
          rank: s.rank,
          name: s.name,
          combinedWins: s.combinedWins,
          combinedLosses: s.combinedLosses,
          pointsFor: s.pointsFor,
        })),
      },
      promptContext
    ),
    config,
    { maxTokens: getMaxTokens('standings') }
  );

  // Top performer spotlight
  const topPerformer = weeklyScores.find((s) => s.rank === 1);
  const topPerformerSpotlight = topPerformer
    ? await generateCommentary(
        PROMPTS.topPerformerSpotlight(
          {
            name: topPerformer.name,
            score: topPerformer.score,
            rank: topPerformer.rank,
            allPlayRecord: `${topPerformer.allPlayWins}-${topPerformer.allPlayLosses}`,
          },
          promptContext
        ),
        config,
        { maxTokens: getMaxTokens('spotlight') }
      )
    : '';

  // Bottom performer roast
  const bottomPerformer = weeklyScores.find((s) => s.rank === weeklyScores.length);
  const bottomPerformerRoast = bottomPerformer
    ? await generateCommentary(
        PROMPTS.bottomPerformerRoast(
          {
            name: bottomPerformer.name,
            score: bottomPerformer.score,
            rank: bottomPerformer.rank,
            allPlayRecord: `${bottomPerformer.allPlayWins}-${bottomPerformer.allPlayLosses}`,
          },
          promptContext
        ),
        config,
        { maxTokens: getMaxTokens('spotlight') }
      )
    : '';

  // Playoff picture (if week 8+)
  let playoffPicture: string | undefined;
  if (week >= 8 && week < playoffWeekStart) {
    const weeksRemaining = playoffWeekStart - week - 1;
    const topSeed = standings[0];
    const currentQualifiers = standings.slice(0, 6);
    const bubbleTeams = standings.slice(5, 8).map((s) => ({
      ...s,
      gamesBack: topSeed.combinedWins - s.combinedWins,
    }));

    playoffPicture = await generateCommentary(
      PROMPTS.playoffPicture(
        {
          week,
          weeksRemaining,
          playoffTeams: 6,
          currentQualifiers: currentQualifiers.map((s) => ({
            rank: s.rank,
            name: s.name,
            wins: s.combinedWins,
            pf: s.pointsFor,
          })),
          bubbleTeams: bubbleTeams.map((s) => ({
            rank: s.rank,
            name: s.name,
            wins: s.combinedWins,
            pf: s.pointsFor,
            gamesBack: s.gamesBack,
          })),
        },
        promptContext
      ),
      config,
      { maxTokens: getMaxTokens('standings') }
    );
  }

  // Closer
  const closer = await generateCommentary(
    PROMPTS.weeklyCloser(
      {
        week,
        playoffImplications: week >= 10 ? 'Playoff implications intensify.' : undefined,
      },
      promptContext
    ),
    config,
    { maxTokens: getMaxTokens('closer') }
  );

  return {
    opener,
    matchupCommentaries,
    standingsAnalysis,
    topPerformerSpotlight,
    bottomPerformerRoast,
    playoffPicture,
    closer,
  };
}

// =============================================================================
// POSTSEASON COMMENTARY
// =============================================================================

export interface PostseasonCommentaryData {
  season: number;
  champion: string;
  championSeed: number;
  runnerUp: string;
  runnerUpSeed: number;
  thirdPlace?: string;
  thirdPlaceSeed?: number;
  toiletBowlLoser: string;
  toiletBowlLoserSeed: number;
  championshipMargin: number;
  playoffMatchups: Array<{
    round: string;
    winner: string;
    winnerSeed: number;
    loser: string;
    loserSeed: number;
    margin: number;
  }>;
}

export interface PostseasonCommentary {
  recap: string;
  championPath: string;
  toiletBowlSummary: string;
}

export async function generatePostseasonCommentary(
  data: PostseasonCommentaryData,
  config: CommentaryConfig = DEFAULT_CONFIG
): Promise<PostseasonCommentary> {
  const promptContext: PromptContext = {
    voice: config.voice,
    template: config.template,
    customVoice: config.customVoice,
    leagueContext: config.leagueContext,
  };

  const templateConfig = REPORT_TEMPLATES[config.template];
  const baseTokens =
    templateConfig.narrativeLength === 'long'
      ? 800
      : templateConfig.narrativeLength === 'medium'
        ? 500
        : 300;

  // Main recap
  const recap = await generateCommentary(
    PROMPTS.postseasonRecap(
      {
        season: data.season,
        champion: data.champion,
        championSeed: data.championSeed,
        runnerUp: data.runnerUp,
        runnerUpSeed: data.runnerUpSeed,
        thirdPlace: data.thirdPlace,
        toiletBowlLoser: data.toiletBowlLoser,
        toiletBowlLoserSeed: data.toiletBowlLoserSeed,
        championshipMargin: data.championshipMargin,
      },
      promptContext
    ),
    config,
    { maxTokens: baseTokens }
  );

  // Champion's path narrative
  const championMatchups = data.playoffMatchups
    .filter((m) => m.winner === data.champion)
    .map((m) => `${m.round}: beat #${m.loserSeed} ${m.loser} by ${m.margin.toFixed(1)}`)
    .join('\n');

  const pathWordCount =
    templateConfig.narrativeLength === 'long'
      ? '200-300'
      : templateConfig.narrativeLength === 'medium'
        ? '100-150'
        : '50-80';

  const championPath = await generateCommentary(
    `Write about ${data.champion}'s championship run:\n\n${championMatchups}\n\nTell the story of their path to the title. Write approximately ${pathWordCount} words.`,
    config,
    { maxTokens: baseTokens }
  );

  // Toilet bowl summary
  const tbWordCount =
    templateConfig.narrativeLength === 'long'
      ? '150-200'
      : templateConfig.narrativeLength === 'medium'
        ? '80-120'
        : '40-60';

  const toiletBowlSummary = await generateCommentary(
    `Write about the Toilet Bowl results. ${data.toiletBowlLoser} (#${data.toiletBowlLoserSeed} seed) finished last and must face the league punishment. In the Toilet Bowl, losers advance toward punishment — ${data.toiletBowlLoser} lost their way to the bottom. Write approximately ${tbWordCount} words.`,
    config,
    { maxTokens: Math.ceil(baseTokens * 0.6) }
  );

  return {
    recap,
    championPath,
    toiletBowlSummary,
  };
}

// =============================================================================
// SINGLE COMMENTARY GENERATION (for ad-hoc use)
// =============================================================================

export async function generateSingleCommentary(
  promptType: keyof typeof PROMPTS,
  data: Record<string, unknown>,
  config: CommentaryConfig = DEFAULT_CONFIG
): Promise<string> {
  const promptFn = PROMPTS[promptType];
  if (typeof promptFn !== 'function') {
    throw new Error(`Unknown prompt type: ${promptType}`);
  }

  const promptContext: PromptContext = {
    voice: config.voice,
    template: config.template,
    customVoice: config.customVoice,
    leagueContext: config.leagueContext,
  };

  // @ts-expect-error - dynamic prompt function call
  const prompt = promptFn(data, promptContext);
  return generateCommentary(prompt, config);
}

// =============================================================================
// RAW GENERATION (for custom prompts)
// =============================================================================

export async function generateRaw(
  prompt: string,
  config: CommentaryConfig = DEFAULT_CONFIG,
  options: GenerateOptions = {}
): Promise<string> {
  return generateCommentary(prompt, config, options);
}

export default {
  generateWeeklyCommentary,
  generatePostseasonCommentary,
  generateSingleCommentary,
  generateRaw,
};
