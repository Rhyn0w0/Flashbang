import type { Infer } from 'convex/values';

import { TAG_KEYS, tagLabel } from '../ai/tags';
import type { tagPreferenceValidator, tagSentimentValidator } from '../schema';

export type TagSentiment = Infer<typeof tagSentimentValidator>;
export type TagPreference = Infer<typeof tagPreferenceValidator>;

const MAX_TRAITS = 5;
// Two fully certain comments' worth of evidence before confidence reaches halfway.
const PRIOR_WEIGHT = 2;
export const COMMENT_HISTORY = 40;

type Taste = { preferences: TagPreference[]; commentCount: number };

/** One update per analysed comment. Unmentioned tags retain their existing evidence. */
export function deriveTaste(previous: Taste | undefined, observations: TagSentiment[]) {
  const preferencesByTag = new Map(previous?.preferences.map((p) => [p.tag, p]));
  for (const observation of observations) {
    if (observation.confidence === 0) continue;
    const existing = preferencesByTag.get(observation.tag) ?? emptyPreference(observation.tag);
    const evidenceWeight = existing.evidenceWeight + observation.confidence;
    const weightedSentiment =
      existing.weightedSentiment + observation.sentiment * observation.confidence;
    const weightedSquaredSentiment =
      existing.weightedSquaredSentiment + observation.sentiment ** 2 * observation.confidence;
    const sentiment = Math.max(-1, Math.min(1, weightedSentiment / evidenceWeight));
    const variance = Math.max(0, weightedSquaredSentiment / evidenceWeight - sentiment ** 2);
    // Agreement and evidence both matter. Opposite reactions reduce confidence;
    // repeated explicit neutrality can still establish a confident neutral preference.
    const confidence =
      (evidenceWeight / (evidenceWeight + PRIOR_WEIGHT)) * Math.max(0, 1 - variance);
    preferencesByTag.set(observation.tag, {
      tag: observation.tag,
      sentiment,
      confidence,
      evidenceWeight,
      weightedSentiment,
      weightedSquaredSentiment,
      commentCount: existing.commentCount + 1,
    });
  }
  const preferences = TAG_KEYS.map((tag) => preferencesByTag.get(tag) ?? emptyPreference(tag));
  const rank = (direction: 1 | -1) =>
    preferences
      .filter((p) => p.sentiment * direction > 0 && p.confidence > 0)
      .sort(
        (a, b) => b.sentiment * direction * b.confidence - a.sentiment * direction * a.confidence
      )
      .slice(0, MAX_TRAITS)
      .map((p) => p.tag);
  const drawnTo = rank(1);
  const putOffBy = rank(-1);
  const commentCount = (previous?.commentCount ?? 0) + 1;
  return {
    preferences,
    commentCount,
    drawnTo,
    putOffBy,
    summary: describe(commentCount, drawnTo, putOffBy),
  };
}

function emptyPreference(tag: TagPreference['tag']): TagPreference {
  return {
    tag,
    sentiment: 0,
    confidence: 0,
    evidenceWeight: 0,
    weightedSentiment: 0,
    weightedSquaredSentiment: 0,
    commentCount: 0,
  };
}

function describe(analyzed: number, drawnTo: string[], putOffBy: string[]) {
  if (drawnTo.length === 0 && putOffBy.length === 0) {
    return 'No clear pattern yet. Keep leaving notes and this will sharpen.';
  }
  const list = (tags: string[]) => {
    const labels = tags.map(tagLabel);
    return labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  };
  const parts = [`From ${analyzed} ${analyzed === 1 ? 'note' : 'notes'}:`];
  if (drawnTo.length > 0) parts.push(`you seem drawn to ${list(drawnTo)}`);
  if (putOffBy.length > 0) {
    parts.push(`${drawnTo.length > 0 ? 'and' : 'you'} seem put off by ${list(putOffBy)}`);
  }
  return parts.join(' ') + '.';
}
