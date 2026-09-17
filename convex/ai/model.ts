import { createGateway } from '@ai-sdk/gateway';

/**
 * The only model instance in the codebase. Jev (TypeSafe AI) is an evaluation model: it
 * answers typed questions about a piece of state with choices, scores, and probabilities,
 * and never generates text. Every AI feature is therefore a set of questions, and any prose
 * shown to users is composed in code from the answers.
 *
 * Reached through Vercel AI Gateway; set AI_GATEWAY_API_KEY on the Convex deployment.
 */
const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });

export const MODEL_ID = 'typesafe-ai/jev';
export const model = gateway.evaluationModel(MODEL_ID);

// Comment text reaches the model; keep it out of provider logs.
export const providerOptions = { gateway: { zeroDataRetention: true } };
