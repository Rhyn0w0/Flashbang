import { v } from 'convex/values';

import { internalMutation, query } from './_generated/server';
import { currentUser, requireUser } from './lib/auth';
import { publicProfile } from './profiles';

const LIKELY_MATCH_THRESHOLD = 0.6;
// A refine claim older than this is assumed to have crashed and may be taken over.
const REFINE_CLAIM_TTL_MS = 10 * 60_000;

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
    // Walk active profiles lazily until one qualifies; stops at the first hit.
    for await (const candidate of ctx.db
      .query('profiles')
      .withIndex('by_active', (q) => q.eq('active', true))) {
      if (candidate.userId === user._id || commented.has(candidate._id)) continue;
      return { pick: null, profile: await publicProfile(ctx, candidate) };
    }
    return null;
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

/**
 * Atomically claim the right to rebuild picks for the author's current comment count.
 * Returns the count to build from, or null when there is nothing new, another run already
 * owns this revision, or picks were already rebuilt for this count. Several delayed refine
 * runs can be queued for the same burst of comments; only the first one past this gate
 * spends money on the model.
 */
export const claimRefine = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const stats = await ctx.db
      .query('authorStats')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!stats || stats.commentCount === 0) return null;
    const count = stats.commentCount;
    // refinedCount is only set once picks were replaced, so a run that saved its taste
    // but failed before ranking is retried by the next run rather than skipped.
    if ((stats.refinedCount ?? 0) >= count) return null;
    const now = Date.now();
    const claimed =
      stats.refineClaimedCount === count &&
      stats.refineClaimedAt !== undefined &&
      now - stats.refineClaimedAt < REFINE_CLAIM_TTL_MS;
    if (claimed) return null;
    await ctx.db.patch(stats._id, { refineClaimedCount: count, refineClaimedAt: now });
    return count;
  },
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
    const stats = await ctx.db
      .query('authorStats')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (stats && (stats.refinedCount ?? 0) < commentCount) {
      await ctx.db.patch(stats._id, { refinedCount: commentCount });
    }
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
