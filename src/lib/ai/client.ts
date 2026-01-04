// Claude API Client Configuration
import Anthropic from '@anthropic-ai/sdk';

// Initialize client - uses ANTHROPIC_API_KEY env var automatically
const anthropic = new Anthropic();

export const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

export const CLAUDE_CONFIG = {
  model: CLAUDE_MODEL,
  maxTokens: 4096,
  temperature: 0.8, // Higher for more creative/varied output
};

export { anthropic };
