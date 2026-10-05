import { expect, test } from 'vitest';

import { deriveTaste } from '../convex/lib/taste';

test('each quality gets its own reaction and unmentioned qualities start unknown', () => {
  const taste = deriveTaste(undefined, [
    { tag: 'humor', sentiment: 1, confidence: 1 },
    { tag: 'showing-off', sentiment: -1, confidence: 1 },
  ]);
  expect(taste).toMatchObject({
    commentCount: 1,
    drawnTo: ['humor'],
    putOffBy: ['showing-off'],
    summary: 'From 1 note: you seem drawn to humor and seem put off by showing off.',
  });
  expect(taste.preferences.find((p) => p.tag === 'humor')).toMatchObject({
    sentiment: 1,
    confidence: 1 / 3,
    commentCount: 1,
  });
  expect(taste.preferences.find((p) => p.tag === 'showing-off')).toMatchObject({
    sentiment: -1,
    confidence: 1 / 3,
    commentCount: 1,
  });
  expect(taste.preferences.find((p) => p.tag === 'communication')).toEqual({
    tag: 'communication',
    sentiment: 0,
    confidence: 0,
    commentCount: 0,
    evidenceWeight: 0,
    weightedSentiment: 0,
    weightedSquaredSentiment: 0,
  });
});

test('consistent feedback increases confidence without strengthening the stated sentiment', () => {
  let taste = deriveTaste(undefined, [{ tag: 'communication', sentiment: 0.5, confidence: 1 }]);
  expect(taste.preferences.find((p) => p.tag === 'communication')).toMatchObject({
    sentiment: 0.5,
    confidence: 1 / 3,
  });
  for (let i = 0; i < 3; i++) {
    taste = deriveTaste(taste, [{ tag: 'communication', sentiment: 0.5, confidence: 1 }]);
  }
  expect(taste.preferences.find((p) => p.tag === 'communication')).toMatchObject({
    sentiment: 0.5,
    confidence: 2 / 3,
    commentCount: 4,
  });
});

test('contradictions reduce confidence and further feedback can reverse a preference', () => {
  const liked = deriveTaste(undefined, [{ tag: 'humor', sentiment: 1, confidence: 1 }]);
  const conflicted = deriveTaste(liked, [{ tag: 'humor', sentiment: -1, confidence: 1 }]);
  expect(conflicted.preferences.find((p) => p.tag === 'humor')).toMatchObject({
    sentiment: 0,
    confidence: 0,
    commentCount: 2,
  });
  const reversed = deriveTaste(conflicted, [{ tag: 'humor', sentiment: -1, confidence: 1 }]);
  const preference = reversed.preferences.find((p) => p.tag === 'humor');
  expect(preference?.sentiment).toBeCloseTo(-1 / 3);
  expect(preference?.confidence).toBeCloseTo(1 / 15);
  expect(reversed.putOffBy).toEqual(['humor']);
});

test('uncertain interpretations have less influence than clear feedback', () => {
  const liked = deriveTaste(undefined, [{ tag: 'pets', sentiment: 1, confidence: 1 }]);
  const updated = deriveTaste(liked, [{ tag: 'pets', sentiment: -1, confidence: 0.1 }]);
  const preference = updated.preferences.find((p) => p.tag === 'pets');
  expect(preference?.sentiment).toBeCloseTo(9 / 11);
  expect(preference?.confidence).toBeCloseTo(0.2375366569);
  expect(preference?.commentCount).toBe(2);
});

test('explicit neutrality is distinguishable from having no evidence', () => {
  const first = deriveTaste(undefined, [{ tag: 'active', sentiment: 0, confidence: 1 }]);
  const second = deriveTaste(first, [{ tag: 'active', sentiment: 0, confidence: 1 }]);
  expect(second.preferences.find((p) => p.tag === 'active')).toMatchObject({
    sentiment: 0,
    confidence: 0.5,
    commentCount: 2,
  });
  expect(second.preferences.find((p) => p.tag === 'ambitious')).toMatchObject({
    sentiment: 0,
    confidence: 0,
    commentCount: 0,
  });
});

test('unrelated comments and zero-confidence guesses leave a preference unchanged', () => {
  const first = deriveTaste(undefined, [{ tag: 'humor', sentiment: 1, confidence: 1 }]);
  const second = deriveTaste(first, [{ tag: 'warmth', sentiment: 0.5, confidence: 1 }]);
  const third = deriveTaste(second, [{ tag: 'humor', sentiment: -1, confidence: 0 }]);
  expect(third.preferences.find((p) => p.tag === 'humor')).toMatchObject({
    sentiment: 1,
    confidence: 1 / 3,
    commentCount: 1,
  });
  expect(third.commentCount).toBe(3);
});

test('older evidence survives more than forty new comments', () => {
  let taste = deriveTaste(undefined, [{ tag: 'family-oriented', sentiment: 1, confidence: 1 }]);
  for (let i = 0; i < 45; i++) taste = deriveTaste(taste, []);
  expect(taste.preferences.find((p) => p.tag === 'family-oriented')).toMatchObject({
    sentiment: 1,
    confidence: 1 / 3,
    commentCount: 1,
  });
  expect(taste.commentCount).toBe(46);
});
