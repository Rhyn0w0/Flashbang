/// <reference types="vite/client" />

import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';

import { api, internal } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import schema from '../convex/schema';
import { deriveTaste } from '../convex/lib/taste';
import { TAG_KEYS } from '../convex/ai/tags';

const modules = import.meta.glob('../convex/**/*.{ts,js}');

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test('refining waits until recent comments have been analyzed', async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', { tokenIdentifier: 'viewer' });
    const otherId = await ctx.db.insert('users', { tokenIdentifier: 'other' });
    const profileId = await ctx.db.insert('profiles', {
      userId: otherId,
      displayName: 'Alex',
      age: 25,
      bio: 'Hiking',
      active: true,
    });
    await ctx.db.insert('comments', {
      authorId: userId,
      targetProfileId: profileId,
      body: 'Love the adventures',
    });
    await ctx.db.insert('authorStats', { userId, commentCount: 1 });
    return userId;
  });

  expect(await t.mutation(internal.picks.claimRefine, { userId })).toBeNull();
});

test('candidate selection fills the pool with unseen active profiles', async () => {
  const t = convexTest(schema, modules);
  const { userId, freshId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', { tokenIdentifier: 'viewer' });
    await ctx.db.insert('profiles', {
      userId,
      displayName: 'Me',
      age: 25,
      bio: '',
      active: true,
    });
    const seenUserId = await ctx.db.insert('users', { tokenIdentifier: 'seen' });
    const seenId = await ctx.db.insert('profiles', {
      userId: seenUserId,
      displayName: 'Seen',
      age: 25,
      bio: '',
      active: true,
    });
    await ctx.db.insert('comments', {
      authorId: userId,
      targetProfileId: seenId,
      body: 'Nice smile',
    });
    const freshUserId = await ctx.db.insert('users', { tokenIdentifier: 'fresh' });
    const freshId = await ctx.db.insert('profiles', {
      userId: freshUserId,
      displayName: 'Fresh',
      age: 25,
      bio: 'Music',
      active: true,
    });
    return { userId, freshId };
  });

  const candidates = await t.query(internal.profiles.listCandidates, {
    forUserId: userId,
    limit: 1,
  });
  expect(candidates.map((p) => p._id)).toEqual([freshId]);
});

test('taste balances positive and negative feedback and ignores pending notes', () => {
  expect(
    deriveTaste([
      { sentiment: 'positive', tags: ['humor', 'warmth'] },
      { sentiment: 'positive', tags: ['humor'] },
      { sentiment: 'negative', tags: ['humor', 'showing-off'] },
      { sentiment: 'neutral', tags: ['active'] },
      { tags: ['active'] },
    ])
  ).toEqual({
    drawnTo: ['humor', 'warmth'],
    putOffBy: ['showing-off'],
    summary: 'From 4 notes: you respond to humor and warmth and are put off by showing off.',
  });
});

async function seedProfiles(t: ReturnType<typeof convexTest<typeof schema.tables>>) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', { tokenIdentifier: 'viewer' });
    const sourceUserId = await ctx.db.insert('users', { tokenIdentifier: 'source' });
    const sourceId = await ctx.db.insert('profiles', {
      userId: sourceUserId,
      displayName: 'Source',
      age: 25,
      bio: 'Funny stories',
      active: true,
    });
    const createCandidate = async (index: number, bio: string) => {
      const candidateUserId = await ctx.db.insert('users', {
        tokenIdentifier: `candidate-${index}`,
      });
      return ctx.db.insert('profiles', {
        userId: candidateUserId,
        displayName: `Candidate ${index}`,
        age: 26,
        bio,
        active: true,
      });
    };
    const candidateIds: [Id<'profiles'>, Id<'profiles'>, Id<'profiles'>] = await Promise.all([
      createCandidate(0, 'Comedy'),
      createCandidate(1, 'Jokes and warmth'),
      createCandidate(2, 'Serious'),
    ]);
    return { userId, sourceId, candidateIds };
  });
}

const analysisResponse = {
  model: 'jev-latest',
  answers: {
    sentiment: {
      type: 'choice',
      choice: 'positive',
      confidence: 0.9,
      probabilities: { positive: 0.95, neutral: 0.04, negative: 0.01 },
    },
    ...Object.fromEntries(
      TAG_KEYS.map((tag) => [tag, { type: 'noul', noul: tag === 'humor' ? 0.9 : 0.1 }])
    ),
  },
  usage: { input_tokens: 100, output_tokens: 20 },
};

const rankingResponse = {
  model: 'jev-latest',
  answers: {
    fit_0: { type: 'score', score: 2.7, confidence: 0.8, legend: {}, probabilities: {} },
    trait_0: { type: 'choice', choice: 'humor', confidence: 0.8, probabilities: {} },
    fit_1: { type: 'score', score: 3, confidence: 0.8, legend: {}, probabilities: {} },
    trait_1: { type: 'choice', choice: 'humor', confidence: 0.8, probabilities: {} },
    fit_2: { type: 'score', score: 1.8, confidence: 0.8, legend: {}, probabilities: {} },
    trait_2: { type: 'choice', choice: 'none', confidence: 0.8, probabilities: {} },
  },
  usage: { input_tokens: 100, output_tokens: 20 },
};

test('private comments produce a taste and ranked unseen picks through the direct SDK', async () => {
  vi.useFakeTimers();
  vi.stubEnv('TYPESAFE_API_KEY', 'test-key');
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify(analysisResponse)))
    .mockResolvedValueOnce(new Response(JSON.stringify(rankingResponse)));
  vi.stubGlobal('fetch', fetch);
  const t = convexTest(schema, modules);
  const { userId, sourceId, candidateIds } = await seedProfiles(t);
  const viewer = t.withIdentity({ tokenIdentifier: 'viewer' });
  const commentId = await viewer.mutation(api.comments.create, {
    targetProfileId: sourceId,
    body: 'I love the humor in this profile.',
  });
  expect(await t.mutation(internal.picks.claimRefine, { userId })).toBeNull();

  await t.finishAllScheduledFunctions(vi.runAllTimers);

  expect(await viewer.query(api.picks.taste)).toMatchObject({
    drawnTo: ['humor'],
    putOffBy: [],
    commentCount: 1,
    summary: 'From 1 note: you respond to humor.',
  });
  const picks = await viewer.query(api.picks.list);
  expect(picks.map(({ profileId, score, reason }) => ({ profileId, score, reason }))).toEqual([
    { profileId: candidateIds[1], score: 1, reason: 'Shows humor, which you tend to respond to.' },
    {
      profileId: candidateIds[0],
      score: 0.9,
      reason: 'Shows humor, which you tend to respond to.',
    },
  ]);
  expect(await viewer.query(api.picks.next)).toMatchObject({ profile: { _id: candidateIds[1] } });
  expect(await t.withIdentity({ tokenIdentifier: 'source' }).query(api.comments.mine, {})).toEqual(
    []
  );
  expect(await viewer.query(api.comments.mine, {})).toMatchObject([
    { sentiment: 'positive', tags: ['humor'] },
  ]);

  await t.action(internal.ai.analyzeComment.run, { commentId });
  await t.action(internal.ai.refinePicks.run, { userId });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    'https://api.typesafe.ai/v1/systemone',
    'https://api.typesafe.ai/v1/systemone',
  ]);
  expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(
    'Bearer test-key'
  );
});

test('stale rankings cannot replace newer taste or picks', async () => {
  const t = convexTest(schema, modules);
  const { userId, candidateIds } = await seedProfiles(t);
  await t.run(async (ctx) => {
    await ctx.db.insert('authorStats', { userId, commentCount: 2, refinedCount: 2 });
    await ctx.db.insert('picks', {
      userId,
      profileId: candidateIds[1],
      score: 1,
      reason: 'Current pick',
    });
    await ctx.db.insert('tastes', {
      userId,
      commentCount: 2,
      drawnTo: ['warmth'],
      putOffBy: [],
      summary: 'Current taste',
      updatedAt: 100,
    });
  });
  await t.mutation(internal.picks.replaceAll, {
    userId,
    commentCount: 1,
    taste: { summary: 'Old taste', drawnTo: ['humor'], putOffBy: [] },
    picks: [],
  });
  const viewer = t.withIdentity({ tokenIdentifier: 'viewer' });
  expect(await viewer.query(api.picks.taste)).toMatchObject({
    summary: 'Current taste',
    commentCount: 2,
  });
  expect(await viewer.query(api.picks.list)).toMatchObject([{ reason: 'Current pick' }]);
});

test('a failed ranking releases its claim and leaves existing picks intact', async () => {
  vi.useFakeTimers();
  vi.stubEnv('TYPESAFE_API_KEY', 'test-key');
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 401 })
      )
  );
  const t = convexTest(schema, modules);
  const { userId, sourceId, candidateIds } = await seedProfiles(t);
  await t.run(async (ctx) => {
    await ctx.db.insert('authorStats', { userId, commentCount: 1 });
    await ctx.db.insert('comments', {
      authorId: userId,
      targetProfileId: sourceId,
      body: 'Funny',
      sentiment: 'positive',
      tags: ['humor'],
      analyzedAt: 1,
    });
    await ctx.db.insert('picks', {
      userId,
      profileId: candidateIds[0],
      score: 0.9,
      reason: 'Existing pick',
    });
  });
  await expect(t.action(internal.ai.refinePicks.run, { userId })).rejects.toThrow();
  expect(await t.withIdentity({ tokenIdentifier: 'viewer' }).query(api.picks.list)).toMatchObject([
    { reason: 'Existing pick' },
  ]);
  expect(await t.mutation(internal.picks.claimRefine, { userId })).toBe(1);
});
