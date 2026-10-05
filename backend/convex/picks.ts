import { v } from 'convex/values';

import { internalMutation, internalQuery, query } from './_generated/server';
import { currentUser, requireUser } from './lib/auth';
import { COMMENT_HISTORY } from './lib/taste';
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
      if (!profile || !profile.active || profile.userId === user._id) continue;
      const commented = await ctx.db
        .query('comments')
        .withIndex('by_author_target', (q) =>
          q.eq('authorId', user._id).eq('targetProfileId', profile._id)
        )
        .first();
      if (commented) continue;
      return {
        pick: { score: pick.score, reason: pick.reason },
        profile: await publicProfile(ctx, profile),
      };
    }

    // Walk active profiles lazily until one the user has not commented on turns up.
    // One indexed lookup per candidate keeps reads bounded by the scan, not by history.
    for await (const candidate of ctx.db
      .query('profiles')
      .withIndex('by_active', (q) => q.eq('active', true))) {
      if (candidate.userId === user._id) continue;
      const commented = await ctx.db
        .query('comments')
        .withIndex('by_author_target', (q) =>
          q.eq('authorId', user._id).eq('targetProfileId', candidate._id)
        )
        .first();
      if (commented) continue;
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

export const tasteForUser = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) =>
    ctx.db
      .query('tastes')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique(),
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
    if (stats.preferenceMigration === 'running') return null;
    const history = await ctx.db
      .query('comments')
      .withIndex('by_author', (q) => q.eq('authorId', userId))
      .order('desc')
      .take(COMMENT_HISTORY);
    if (history.some((note) => !note.sentiment || !note.tags)) return null;
    const count = stats.commentCount;
    // Only a successful atomic save marks the revision as refined.
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

export const releaseRefine = internalMutation({
  args: { userId: v.id('users'), commentCount: v.number() },
  handler: async (ctx, { userId, commentCount }) => {
    const stats = await ctx.db
      .query('authorStats')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (stats?.refineClaimedCount === commentCount) {
      await ctx.db.patch(stats._id, { refineClaimedCount: undefined, refineClaimedAt: undefined });
    }
  },
});

/**
 * Replace a user's pick set. Keeps seenAt for profiles that were already shown.
 * `commentCount` is the history size the picks were computed from; a run based on
 * a revision that no longer matches the current comment count is dropped.
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
    const stats = await ctx.db
      .query('authorStats')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!stats || stats.commentCount !== commentCount || (stats.refinedCount ?? 0) >= commentCount)
      return;
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
    await ctx.db.patch(stats._id, { refinedCount: commentCount });
  },
});

export { LIKELY_MATCH_THRESHOLD };
