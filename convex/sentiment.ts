import { v } from 'convex/values';

import { internalMutation, internalQuery, query } from './_generated/server';
import { requireProfile } from './lib/auth';
import { LIKELY_MATCH_THRESHOLD } from './picks';
import { sentimentCounts } from './schema';

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
 * Counts analysed comments on a photo, split into everyone vs. commenters the
 * photo owner is likely attracted to. "Likely" means the commenter's profile
 * sits in the owner's picks above LIKELY_MATCH_THRESHOLD.
 */
export const countsForPhoto = internalQuery({
  args: { photoId: v.id('photos') },
  handler: async (ctx, { photoId }) => {
    const photo = await ctx.db.get(photoId);
    if (!photo) return null;
    const ownerProfile = await ctx.db.get(photo.profileId);
    if (!ownerProfile) return null;

    const comments = await ctx.db
      .query('comments')
      .withIndex('by_photo', (q) => q.eq('photoId', photoId))
      .collect();

    const overall = { positive: 0, neutral: 0, negative: 0 };
    const fromLikelyMatches = { positive: 0, neutral: 0, negative: 0 };
    const tagCounts = new Map<string, number>();

    for (const c of comments) {
      if (!c.sentiment) continue;
      overall[c.sentiment] += 1;
      for (const t of c.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);

      const authorProfile = await ctx.db
        .query('profiles')
        .withIndex('by_user', (q) => q.eq('userId', c.authorId))
        .unique();
      if (!authorProfile) continue;
      const pick = await ctx.db
        .query('picks')
        .withIndex('by_user_profile', (q) =>
          q.eq('userId', ownerProfile.userId).eq('profileId', authorProfile._id)
        )
        .unique();
      if (pick && pick.score >= LIKELY_MATCH_THRESHOLD) fromLikelyMatches[c.sentiment] += 1;
    }

    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);

    return { profileId: photo.profileId, overall, fromLikelyMatches, topTags };
  },
});

export const save = internalMutation({
  args: {
    photoId: v.id('photos'),
    profileId: v.id('profiles'),
    overall: sentimentCounts,
    fromLikelyMatches: sentimentCounts,
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('photoSentiment')
      .withIndex('by_photo', (q) => q.eq('photoId', args.photoId))
      .unique();
    const row = { ...args, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert('photoSentiment', row);
  },
});
