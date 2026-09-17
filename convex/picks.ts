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
    for (const pick of picks) {
      if (pick.seenAt) continue;
      const profile = await ctx.db.get(pick.profileId);
      if (!profile || !profile.active) continue;
      return {
        pick: { score: pick.score, reason: pick.reason },
        profile: await publicProfile(ctx, profile),
      };
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

/**
 * Replace a user's pick set. Keeps seenAt for profiles that were already shown.
 * `commentCount` is the history size the picks were computed from; a run based on
 * fewer comments than the stored taste is stale and is dropped.
 */
export const replaceAll = internalMutation({
  args: {
    userId: v.id('users'),
    commentCount: v.number(),
    picks: v.array(
      v.object({ profileId: v.id('profiles'), score: v.number(), reason: v.string() })
    ),
  },
  handler: async (ctx, { userId, commentCount, picks }) => {
    const taste = await ctx.db
      .query('tastes')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (taste && taste.commentCount > commentCount) return;
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
    // Ignore a result computed from an older history than what is already stored.
    if (existing && existing.commentCount > args.commentCount) return;
    const row = { ...args, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert('tastes', row);
  },
});

export { LIKELY_MATCH_THRESHOLD };
