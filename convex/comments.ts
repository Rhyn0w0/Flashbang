import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { requireUser } from './lib/auth';
import { sentimentValidator } from './schema';

const MAX_COMMENT_LENGTH = 1000;
// Delay before re-ranking so a burst of comments costs one model run, not one per comment.
const REFINE_DELAY_MS = 30_000;

/**
 * The only write path for comments. Kicks off the two async AI jobs:
 * sentiment analysis of this comment, and a refresh of the author's picks.
 */
export const create = mutation({
  args: {
    targetProfileId: v.id('profiles'),
    photoId: v.optional(v.id('photos')),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const body = args.body.trim();
    if (!body) throw new Error('Comment is empty');
    if (body.length > MAX_COMMENT_LENGTH) throw new Error('Comment is too long');
    const target = await ctx.db.get(args.targetProfileId);
    if (!target || !target.active) throw new Error('Profile not found');
    if (target.userId === user._id) throw new Error('Cannot comment on your own profile');
    if (args.photoId) {
      const photo = await ctx.db.get(args.photoId);
      if (!photo || photo.profileId !== target._id) throw new Error('Photo not on this profile');
    }

    const commentId = await ctx.db.insert('comments', {
      authorId: user._id,
      targetProfileId: args.targetProfileId,
      photoId: args.photoId,
      body,
    });

    const stats = await ctx.db
      .query('authorStats')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    if (stats) await ctx.db.patch(stats._id, { commentCount: stats.commentCount + 1 });
    else await ctx.db.insert('authorStats', { userId: user._id, commentCount: 1 });

    // Mark the pick as seen so Discover moves on.
    const pick = await ctx.db
      .query('picks')
      .withIndex('by_user_profile', (q) =>
        q.eq('userId', user._id).eq('profileId', args.targetProfileId)
      )
      .unique();
    if (pick && !pick.seenAt) await ctx.db.patch(pick._id, { seenAt: Date.now() });

    await ctx.scheduler.runAfter(0, internal.ai.analyzeComment.run, { commentId });
    await ctx.scheduler.runAfter(REFINE_DELAY_MS, internal.ai.refinePicks.run, {
      userId: user._id,
    });
    return commentId;
  },
});

/** The author's own comments. Comments are never readable by anyone else. */
export const mine = query({
  args: { targetProfileId: v.optional(v.id('profiles')) },
  handler: async (ctx, { targetProfileId }) => {
    const user = await requireUser(ctx);
    if (targetProfileId) {
      return ctx.db
        .query('comments')
        .withIndex('by_author_target', (q) =>
          q.eq('authorId', user._id).eq('targetProfileId', targetProfileId)
        )
        .collect();
    }
    return ctx.db
      .query('comments')
      .withIndex('by_author', (q) => q.eq('authorId', user._id))
      .order('desc')
      .take(100);
  },
});

// ---- Internal helpers used by the AI actions ----

export const getInternal = internalQuery({
  args: { commentId: v.id('comments') },
  handler: async (ctx, { commentId }) => {
    const comment = await ctx.db.get(commentId);
    if (!comment) return null;
    const target = await ctx.db.get(comment.targetProfileId);
    return { comment, target };
  },
});

export const recentByAuthor = internalQuery({
  args: { authorId: v.id('users'), limit: v.number() },
  handler: async (ctx, { authorId, limit }) => {
    const comments = await ctx.db
      .query('comments')
      .withIndex('by_author', (q) => q.eq('authorId', authorId))
      .order('desc')
      .take(limit);
    return Promise.all(
      comments.map(async (c) => {
        const target = await ctx.db.get(c.targetProfileId);
        return {
          body: c.body,
          sentiment: c.sentiment,
          tags: c.tags,
          target: target
            ? { displayName: target.displayName, age: target.age, bio: target.bio }
            : null,
        };
      })
    );
  },
});

export const saveAnalysis = internalMutation({
  args: {
    commentId: v.id('comments'),
    sentiment: sentimentValidator,
    tags: v.array(v.string()),
  },
  handler: async (ctx, { commentId, sentiment, tags }) => {
    await ctx.db.patch(commentId, { sentiment, tags, analyzedAt: Date.now() });
  },
});
