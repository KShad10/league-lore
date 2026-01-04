// AI Module - Claude API integration for League Lore commentary
export { anthropic, CLAUDE_CONFIG } from './client';

export {
  generateWeeklyCommentary,
  generatePostseasonCommentary,
  generateSingleCommentary,
  generateRaw,
} from './generator';

export type {
  WeeklyCommentaryData,
  WeeklyCommentary,
  PostseasonCommentaryData,
  PostseasonCommentary,
  GenerateOptions,
  CommentaryConfig,
} from './generator';

export {
  VOICE_PRESETS,
  REPORT_TEMPLATES,
  buildSystemPrompt,
  buildLeagueContextPrompt,
  PROMPTS,
} from './prompts';

export type {
  VoicePreset,
  VoiceConfig,
  ReportTemplate,
  TemplateConfig,
  LeagueContext,
  PromptContext,
} from './prompts';
