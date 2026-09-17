import { experimental_evaluate as evaluate } from 'ai';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { internalAction } from '../_generated/server';
import { model, providerOptions } from './model';
import { TAGS, TAG_KEYS } from './tags';

// A tag is kept when the model is at least this sure the note reacts to it.
const TAG_THRESHOLD = 0.6;
const MAX_TAGS = 6;

const sentimentQuestion = {
  type: 'choice',
  instructions: 'How does the writer of this note feel about the profile it describes?',
  criteria: {
    positive: 'attracted, interested, or complimentary',
    neutral: 'mixed, indifferent, or purely descriptive',
    negative: 'put off, uninterested, or critical',
  },
} as const;

const tagQuestions = Object.fromEntries(
  TAG_KEYS.map((tag) => [
    tag,
    {
      type: 'boolean',
      instructions: `Does the note react to ${TAGS[tag]}?`,
    } as const,
  ])
) as Record<(typeof TAG_KEYS)[number], { type: 'boolean'; instructions: string }>;

/**
 * Labels one comment with a sentiment and generic tags in a single Jev call, then, if the
 * comment was left on a photo, rebuilds that photo's sentiment summary. Scheduled by
 * comments.create.
 */
export const run = internalAction({
  args: { commentId: v.id('comments') },
  handler: async (ctx, { commentId }) => {
    const loaded = await ctx.runQuery(internal.comments.getInternal, { commentId });
    if (!loaded) return;
    const { comment, target } = loaded;

    const { answers } = await evaluate({
      model,
      providerOptions,
      state: {
        note: comment.body,
        aboutProfile: target ? { age: target.age, city: target.city, bio: target.bio } : null,
      },
      questions: { sentiment: sentimentQuestion, ...tagQuestions },
    });

    const tags = TAG_KEYS.map((tag) => ({ tag, p: answers[tag].probability }))
      .filter(({ p }) => p >= TAG_THRESHOLD)
      .sort((a, b) => b.p - a.p)
      .slice(0, MAX_TAGS)
      .map(({ tag }) => tag);

    await ctx.runMutation(internal.comments.saveAnalysis, {
      commentId,
      sentiment: answers.sentiment.choice,
      tags,
    });

    if (comment.photoId) {
      await ctx.runMutation(internal.sentiment.rebuildForPhoto, { photoId: comment.photoId });
    }
  },
});
