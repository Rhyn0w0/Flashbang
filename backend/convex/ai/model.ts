import { TypeSafeClient } from '@typesafe-ai/sdk';

export const MODEL_ID = 'jev-latest';

// Construct inside actions so code generation and queries work without an API key.
export function getModelClient() {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Set TYPESAFE_API_KEY on the Convex deployment to enable matching.');
  }
  return new TypeSafeClient({
    apiKey,
    defaultModel: MODEL_ID,
    // SDK debug logs include request bodies, which contain private comments.
    logLevel: 'off',
  });
}
