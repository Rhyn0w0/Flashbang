import { Output, generateText } from 'ai';
import { v } from 'convex/values';
import { z } from 'zod';

import { internal } from '../_generated/api';
import { internalAction } from '../_generated/server';
import { model, providerOptions } from './model';

const summarySchema = z.object({
  // One or two sentences addressed to the photo's owner. No quotes from comments.
  summary: z.string().max(400),
});

/**
 * Rebuilds the aggregate sentiment shown to a photo's owner. Only counts and
 * tags reach the model; raw comment text never does.
 */
export const run = internalAction({
  args: { photoId: v.id('photos') },
  handler: async (ctx, { photoId }) => {
    const counts = await ctx.runQuery(internal.sentiment.countsForPhoto, { photoId });
    if (!counts) return;

    let summary = 'No feedback yet.';

    if (counts.commentCount > 0) {
      const { output } = await generateText({
        model,
        providerOptions,
        output: Output.object({ schema: summarySchema }),
        system: [
          'You write a short, kind, honest note to a dating-app user about how one of their',
          'photos is landing. You are given sentiment counts from everyone, sentiment counts',
          'from people they are likely attracted to, and the most common themes.',
          'Two sentences at most. Second person. Never invent specifics beyond the data.',
        ].join(' '),
        prompt: JSON.stringify({
          everyone: counts.overall,
          likelyMatches: counts.fromLikelyMatches,
          themes: counts.topTags,
        }),
      });
      summary = output.summary;
    }

    await ctx.runMutation(internal.sentiment.save, {
      photoId,
      profileId: counts.profileId,
      overall: counts.overall,
      fromLikelyMatches: counts.fromLikelyMatches,
      summary,
      commentCount: counts.commentCount,
    });
  },
});
