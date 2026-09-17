import { createAnthropic } from '@ai-sdk/anthropic';

/**
 * Single place the model is configured. Set the key on the deployment:
 *   npx convex env set ANTHROPIC_API_KEY sk-ant-...
 */
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const MODEL_ID = 'claude-opus-5';

export const model = anthropic(MODEL_ID);

/** Default Anthropic options for the short, structured calls this app makes. */
export const providerOptions = {
  anthropic: {
    thinking: { type: 'adaptive' as const },
    effort: 'low' as const,
  },
};
