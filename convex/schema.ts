import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const sentimentValidator = v.union(
  v.literal('positive'),
  v.literal('neutral'),
  v.literal('negative')
);

export const sentimentCounts = v.object({
  positive: v.number(),
  neutral: v.number(),
  negative: v.number(),
});

export default defineSchema({
  // One row per authenticated identity. Populated by users.ensure on first sign-in.
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  }).index('by_token', ['tokenIdentifier']),

  // Public-facing dating profile. One per user.
  profiles: defineTable({
    userId: v.id('users'),
    displayName: v.string(),
    age: v.number(),
    bio: v.string(),
    city: v.optional(v.string()),
    active: v.boolean(),
  })
    .index('by_user', ['userId'])
    .index('by_active', ['active']),

  photos: defineTable({
    profileId: v.id('profiles'),
    storageId: v.id('_storage'),
    order: v.number(),
  }).index('by_profile', ['profileId', 'order']),

  // The core interaction. Private to the author; never exposed to the target.
  comments: defineTable({
    authorId: v.id('users'),
    targetProfileId: v.id('profiles'),
    photoId: v.optional(v.id('photos')),
    body: v.string(),
    // Filled in by ai/analyzeComment after creation.
    sentiment: v.optional(sentimentValidator),
    tags: v.optional(v.array(v.string())),
    analyzedAt: v.optional(v.number()),
  })
    .index('by_author', ['authorId'])
    .index('by_author_target', ['authorId', 'targetProfileId'])
    .index('by_target', ['targetProfileId'])
    .index('by_photo', ['photoId']),

  // What the model currently believes a user is looking for. Rebuilt from their comments.
  tastes: defineTable({
    userId: v.id('users'),
    summary: v.string(),
    drawnTo: v.array(v.string()),
    putOffBy: v.array(v.string()),
    commentCount: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  // Ranked suggestions for a user, produced by ai/refinePicks.
  picks: defineTable({
    userId: v.id('users'),
    profileId: v.id('profiles'),
    score: v.number(), // 0..1, higher is a stronger suggestion
    reason: v.string(),
    seenAt: v.optional(v.number()),
  })
    .index('by_user_score', ['userId', 'score'])
    .index('by_user_profile', ['userId', 'profileId']),

  // Aggregated, anonymised feedback shown to the photo's owner.
  photoSentiment: defineTable({
    photoId: v.id('photos'),
    profileId: v.id('profiles'),
    overall: sentimentCounts,
    fromLikelyMatches: sentimentCounts,
    summary: v.string(),
    updatedAt: v.number(),
  })
    .index('by_photo', ['photoId'])
    .index('by_profile', ['profileId']),
});
