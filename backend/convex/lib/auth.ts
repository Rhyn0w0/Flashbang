import type { Doc } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

/**
 * Looks up the users row for the calling identity. Returns null when signed out
 * or when users.ensure has not run yet for this identity.
 */
export async function currentUser(ctx: QueryCtx | MutationCtx): Promise<Doc<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return ctx.db
    .query('users')
    .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
    .unique();
}

export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<'users'>> {
  const user = await currentUser(ctx);
  if (!user) throw new Error('Not signed in');
  return user;
}

export async function requireProfile(ctx: QueryCtx | MutationCtx) {
  const user = await requireUser(ctx);
  const profile = await ctx.db
    .query('profiles')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .unique();
  if (!profile) throw new Error('Create a profile first');
  return { user, profile };
}
