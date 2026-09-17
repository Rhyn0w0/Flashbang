import { Output, generateText } from 'ai';
import { v } from 'convex/values';
import { z } from 'zod';

import { internal } from '../_generated/api';
import { internalAction } from '../_generated/server';
import { model, providerOptions } from './model';

const analysisSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  // Short, generic, non-identifying attributes the comment reacts to, e.g. "smile", "outdoors".
  tags: z.array(z.string().min(1).max(30)).max(6),
});

/**
 * Classifies one comment and, if it was left on a photo, refreshes that photo's
 * sentiment summary. Scheduled by comments.create.
 */
export const run = internalAction({
  args: { commentId: v.id('comments') },
  handler: async (ctx, { commentId }) => {
    const loaded = await ctx.runQuery(internal.comments.getInternal, { commentId });
    if (!loaded) return;
    const { comment } = loaded;

    const { output } = await generateText({
      model,
      providerOptions,
      output: Output.object({ schema: analysisSchema }),
      system: [
        'You classify private notes a dating-app user wrote about another profile.',
        'Return the overall sentiment toward the profile and up to six short lowercase tags',
        'naming what the note reacts to (features, vibe, activities, style).',
        'Tags must be generic and never identify a person.',
      ].join(' '),
      prompt: comment.body,
    });

    await ctx.runMutation(internal.comments.saveAnalysis, {
      commentId,
      sentiment: output.sentiment,
      tags: output.tags,
    });

    if (comment.photoId) {
      await ctx.scheduler.runAfter(0, internal.ai.summarizePhoto.run, { photoId: comment.photoId });
    }
  },
});
