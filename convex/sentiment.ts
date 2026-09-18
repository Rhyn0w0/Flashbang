import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';

import { internalMutation, query } from './_generated/server';
import { requireProfile } from './lib/auth';
import { composeSummary } from './lib/sentimentSummary';
import { LIKELY_MATCH_THRESHOLD } from './picks';

/** Sentiment summaries for the caller's own photos. Aggregates only, no comment text. */
export const forMyPhotos = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    return ctx.db
      .query('photoSentiment')
      .withIndex('by_profile', (q) => q.eq('profileId', profile._id))
      .collect();
  },
});

/**
 * Rebuilds the aggregate shown to a photo's owner from the analysed comments on it,
 * split into everyone vs. commenters the owner is likely attracted to. "Likely" means
 * the commenter's profile sits in the owner's picks above LIKELY_MATCH_THRESHOLD.
 * The summary sentence is composed from counts alone; no comment text is involved.
 */
export const rebuildForPhoto = internalMutation({
  args: { photoId: v.id('photos') },
  handler: async (ctx, { photoId }) => {
    const photo = await ctx.db.get(photoId);
    if (!photo) return;
    const ownerProfile = await ctx.db.get(photo.profileId);
    if (!ownerProfile) return;

    const comments = await ctx.db
      .query('comments')
      .withIndex('by_photo', (q) => q.eq('photoId', photoId))
      .collect();

    const overall = { positive: 0, neutral: 0, negative: 0 };
    const fromLikelyMatches = { positive: 0, neutral: 0, negative: 0 };
    const tagCounts = new Map<string, number>();

    // Resolve "is this author a likely match for the owner" once per distinct author.
    const likelyByAuthor = new Map<Id<'users'>, boolean>();
    const isLikelyMatch = async (authorId: Id<'users'>) => {
      const cached = likelyByAuthor.get(authorId);
      if (cached !== undefined) return cached;
      const authorProfile = await ctx.db
        .query('profiles')
        .withIndex('by_user', (q) => q.eq('userId', authorId))
        .unique();
      const pick = authorProfile
        ? await ctx.db
            .query('picks')
            .withIndex('by_user_profile', (q) =>
              q.eq('userId', ownerProfile.userId).eq('profileId', authorProfile._id)
            )
            .unique()
        : null;
      const likely = !!pick && pick.score >= LIKELY_MATCH_THRESHOLD;
      likelyByAuthor.set(authorId, likely);
      return likely;
    };

    for (const c of comments) {
      if (!c.sentiment) continue;
      overall[c.sentiment] += 1;
      for (const t of c.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      if (await isLikelyMatch(c.authorId)) fromLikelyMatches[c.sentiment] += 1;
    }

    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
    const commentCount = overall.positive + overall.neutral + overall.negative;

    const existing = await ctx.db
      .query('photoSentiment')
      .withIndex('by_photo', (q) => q.eq('photoId', photoId))
      .unique();
    // Several analyses can be in flight for one photo; never let an older snapshot win.
    if (existing && existing.commentCount > commentCount) return;
    const row = {
      photoId,
      profileId: photo.profileId,
      overall,
      fromLikelyMatches,
      summary: composeSummary(overall, fromLikelyMatches, topTags),
      commentCount,
      updatedAt: Date.now(),
    };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert('photoSentiment', row);
  },
});
