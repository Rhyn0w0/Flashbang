import { mutation, query } from './_generated/server';
import { currentUser } from './lib/auth';

export const current = query({
  args: {},
  handler: async (ctx) => currentUser(ctx),
});

/** Call once after sign-in. Idempotent. */
export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not signed in');
    const existing = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique();
    if (existing) return existing._id;
    return ctx.db.insert('users', {
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name,
      email: identity.email,
    });
  },
});
