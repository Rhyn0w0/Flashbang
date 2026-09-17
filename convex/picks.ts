import { v } from 'convex/values';

import { internalMutation, internalQuery, query } from './_generated/server';
import { currentUser, requireUser } from './lib/auth';
import { publicProfile } from './profiles';

const LIKELY_MATCH_THRESHOLD = 0.6;

/**
 * The next profile to show on Discover. Prefers the highest-scored unseen pick;
 * falls back to any active profile the user has not commented on yet, so the
 * app works before the model has anything to go on.
 */
export const next = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;

    const picks = await ctx.db
      .query('picks')
      .withIndex('by_user_score', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(20);
    const unseen = picks.find((p) => !p.seenAt);
    if (unseen) {
      const profile = await ctx.db.get(unseen.profileId);
      if (profile && profile.active) {
        return {
          pick: { score: unseen.score, reason: unseen.reason },
          profile: await publicProfile(ctx, profile),
        };
      }
    }

    const commented = new Set(
      (
        await ctx.db
          .query('comments')
          .withIndex('by_author', (q) => q.eq('authorId', user._id))
          .collect()
      ).map((c) => c.targetProfileId)
    );
    const active = await ctx.db
      .query('profiles')
      .withIndex('by_active', (q) => q.eq('active', true))
      .take(50);
    const fallback = active.find((p) => p.userId !== user._id && !commented.has(p._id));
    if (!fallback) return null;
    return { pick: null, profile: await publicProfile(ctx, fallback) };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const picks = await ctx.db
      .query('picks')
      .withIndex('by_user_score', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(20);
    const rows = await Promise.all(
      picks.map(async (pick) => {
        const profile = await ctx.db.get(pick.profileId);
        if (!profile || !profile.active) return null;
        return { ...pick, profile: await publicProfile(ctx, profile) };
      })
    );
    return rows.filter((r) => r !== null);
  },
});

export const taste = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    return ctx.db
      .query('tastes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
  },
});

export const getTaste = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) =>
    ctx.db
      .query('tastes')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique(),
});

/** Replace a user's pick set. Keeps seenAt for profiles that were already shown. */
export const replaceAll = internalMutation({
  args: {
    userId: v.id('users'),
    picks: v.array(
      v.object({ profileId: v.id('profiles'), score: v.number(), reason: v.string() })
    ),
  },
  handler: async (ctx, { userId, picks }) => {
    const existing = await ctx.db
      .query('picks')
      .withIndex('by_user_score', (q) => q.eq('userId', userId))
      .collect();
    const seen = new Map(existing.map((p) => [p.profileId, p.seenAt]));
    await Promise.all(existing.map((p) => ctx.db.delete(p._id)));
    await Promise.all(
      picks.map((p) =>
        ctx.db.insert('picks', { userId, ...p, seenAt: seen.get(p.profileId) ?? undefined })
      )
    );
  },
});

export const saveTaste = internalMutation({
  args: {
    userId: v.id('users'),
    summary: v.string(),
    drawnTo: v.array(v.string()),
    putOffBy: v.array(v.string()),
    commentCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('tastes')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique();
    const row = { ...args, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert('tastes', row);
  },
});

export { LIKELY_MATCH_THRESHOLD };
