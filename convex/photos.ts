import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireProfile } from './lib/auth';

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireProfile(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

export const add = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }) => {
    const { profile } = await requireProfile(ctx);
    const existing = await ctx.db
      .query('photos')
      .withIndex('by_profile', (q) => q.eq('profileId', profile._id))
      .collect();
    return ctx.db.insert('photos', { profileId: profile._id, storageId, order: existing.length });
  },
});

export const remove = mutation({
  args: { photoId: v.id('photos') },
  handler: async (ctx, { photoId }) => {
    const { profile } = await requireProfile(ctx);
    const photo = await ctx.db.get(photoId);
    if (!photo || photo.profileId !== profile._id) throw new Error('Not your photo');
    await ctx.storage.delete(photo.storageId);
    await ctx.db.delete(photoId);
    const sentiment = await ctx.db
      .query('photoSentiment')
      .withIndex('by_photo', (q) => q.eq('photoId', photoId))
      .unique();
    if (sentiment) await ctx.db.delete(sentiment._id);
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    const photos = await ctx.db
      .query('photos')
      .withIndex('by_profile', (q) => q.eq('profileId', profile._id))
      .collect();
    return Promise.all(
      photos.map(async (p) => ({ ...p, url: await ctx.storage.getUrl(p.storageId) }))
    );
  },
});
