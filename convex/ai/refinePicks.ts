import { Output, generateText } from 'ai';
import type { FunctionReturnType } from 'convex/server';
import { v } from 'convex/values';
import { z } from 'zod';

import { internal } from '../_generated/api';
import { internalAction } from '../_generated/server';
import { model, providerOptions } from './model';

const COMMENT_HISTORY = 40;
const CANDIDATE_POOL = 30;
const MAX_PICKS = 10;

const tasteSchema = z.object({
  summary: z.string().max(600),
  drawnTo: z.array(z.string().max(40)).max(8),
  putOffBy: z.array(z.string().max(40)).max(8),
});

const picksSchema = z.object({
  picks: z
    .array(
      z.object({
        index: z.number().int().min(0),
        score: z.number().min(0).max(1),
        reason: z.string().max(200),
      })
    )
    .max(MAX_PICKS),
});

/**
 * Two model calls: distill the user's comment history into a taste profile,
 * then rank a candidate pool against it. Scheduled after every new comment with a
 * short delay so bursts of comments only trigger one rebuild.
 * Naive on purpose; swap the candidate pool for a vector search when it grows.
 */
export const run = internalAction({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    // Runs are scheduled with a delay, so several comments in a row collapse into one
    // rebuild: the claim is granted to exactly one run per comment-count revision. Comments
    // that land while this run is in flight have already scheduled their own run.
    const totalComments = await ctx.runMutation(internal.picks.claimRefine, { userId });
    if (totalComments === null) return;

    const history = await ctx.runQuery(internal.comments.recentByAuthor, {
      authorId: userId,
      limit: COMMENT_HISTORY,
    });

    const { output: taste } = await generateText({
      model,
      providerOptions,
      output: Output.object({ schema: tasteSchema }),
      system: [
        'You infer what a dating-app user is looking for from private notes they wrote about',
        'other profiles. Summarise their taste in a short paragraph, then list generic traits',
        'they are drawn to and traits that put them off. Be concrete about patterns, never',
        'about individuals. Do not quote the notes.',
      ].join(' '),
      prompt: JSON.stringify(
        history.map((h) => ({
          about: h.target,
          note: h.body,
          sentiment: h.sentiment,
          tags: h.tags,
        }))
      ),
    });

    await ctx.runMutation(internal.picks.saveTaste, {
      userId,
      ...taste,
      commentCount: totalComments,
    });

    const candidates = await ctx.runQuery(internal.profiles.listCandidates, {
      forUserId: userId,
      limit: CANDIDATE_POOL,
    });
    // With no candidates the pick set is replaced with nothing, which still marks this
    // revision as refined so the next run does not redo the taste call.
    const picks = candidates.length === 0 ? [] : await rankCandidates(taste, candidates);

    await ctx.runMutation(internal.picks.replaceAll, {
      userId,
      commentCount: totalComments,
      picks,
    });
  },
});

async function rankCandidates(
  taste: z.infer<typeof tasteSchema>,
  candidates: FunctionReturnType<typeof internal.profiles.listCandidates>
) {
  const { output: ranked } = await generateText({
    model,
    providerOptions,
    output: Output.object({ schema: picksSchema }),
    system: [
      'You rank dating profiles for one user given a description of their taste.',
      `Return at most ${MAX_PICKS} candidates by index, each with a 0-1 score and a one-line`,
      'reason written to the user ("You tend to like..."). Skip weak fits entirely.',
    ].join(' '),
    prompt: JSON.stringify({
      taste,
      candidates: candidates.map((c, index) => ({
        index,
        age: c.age,
        city: c.city,
        bio: c.bio,
      })),
    }),
  });

  // The model may repeat an index; keep the first occurrence so each profile has one pick row.
  const seenIndexes = new Set<number>();
  return ranked.picks
    .filter(
      (p) => p.index < candidates.length && !seenIndexes.has(p.index) && seenIndexes.add(p.index)
    )
    .map((p) => ({ profileId: candidates[p.index]._id, score: p.score, reason: p.reason }));
}
