import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { internalQuery, mutation, query, type QueryCtx } from './_generated/server';
import { currentUser, requireUser } from './lib/auth';

/** Shape of a profile as seen by other users. Never includes userId. */
export async function publicProfile(ctx: QueryCtx, profile: Doc<'profiles'>) {
  const photos = await ctx.db
    .query('photos')
    .withIndex('by_profile', (q) => q.eq('profileId', profile._id))
    .collect();
  const withUrls = await Promise.all(
    photos.map(async (p) => ({
      _id: p._id,
      order: p.order,
      url: await ctx.storage.getUrl(p.storageId),
    }))
  );
  return {
    _id: profile._id,
    displayName: profile.displayName,
    age: profile.age,
    bio: profile.bio,
    city: profile.city,
    photos: withUrls,
  };
}

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    return ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
  },
});

export const upsertMine = mutation({
  args: {
    displayName: v.string(),
    age: v.number(),
    bio: v.string(),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return ctx.db.insert('profiles', { ...args, userId: user._id, active: true });
  },
});

export const get = query({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, { profileId }) => {
    await requireUser(ctx);
    const profile = await ctx.db.get(profileId);
    if (!profile || !profile.active) return null;
    return publicProfile(ctx, profile);
  },
});

/** Candidate pool for the recommender. Internal only. */
export const listCandidates = internalQuery({
  args: { forUserId: v.id('users'), limit: v.number() },
  handler: async (ctx, { forUserId, limit }) => {
    const active = await ctx.db
      .query('profiles')
      .withIndex('by_active', (q) => q.eq('active', true))
      .take(limit + 1);
    const candidates: {
      _id: Id<'profiles'>;
      displayName: string;
      age: number;
      bio: string;
      city?: string;
    }[] = [];
    for (const p of active) {
      if (p.userId === forUserId) continue;
      candidates.push({
        _id: p._id,
        displayName: p.displayName,
        age: p.age,
        bio: p.bio,
        city: p.city,
      });
      if (candidates.length >= limit) break;
    }
    return candidates;
  },
});
