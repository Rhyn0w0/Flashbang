import { tagLabel } from '../ai/tags';

export type AnalyzedNote = { sentiment?: 'positive' | 'neutral' | 'negative'; tags?: string[] };

const MAX_TRAITS = 5;

/**
 * Distils a user's analysed notes into the traits they respond to and the ones that put
 * them off. Pure tag arithmetic: a tag counts toward "drawn to" when it appears in more
 * positive than negative notes, and vice versa.
 */
export function deriveTaste(notes: AnalyzedNote[]) {
  const positive = new Map<string, number>();
  const negative = new Map<string, number>();
  let analyzed = 0;
  for (const note of notes) {
    if (!note.sentiment || !note.tags) continue;
    analyzed += 1;
    const bucket =
      note.sentiment === 'positive' ? positive : note.sentiment === 'negative' ? negative : null;
    if (!bucket) continue;
    for (const tag of note.tags) bucket.set(tag, (bucket.get(tag) ?? 0) + 1);
  }

  const rank = (own: Map<string, number>, other: Map<string, number>) =>
    [...own.entries()]
      .filter(([tag, count]) => count > (other.get(tag) ?? 0))
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TRAITS)
      .map(([tag]) => tag);

  const drawnTo = rank(positive, negative);
  const putOffBy = rank(negative, positive);
  return { drawnTo, putOffBy, summary: describe(analyzed, drawnTo, putOffBy) };
}

function describe(analyzed: number, drawnTo: string[], putOffBy: string[]) {
  if (drawnTo.length === 0 && putOffBy.length === 0) {
    return analyzed === 0
      ? 'Your notes are still being read. Check back in a moment.'
      : 'No clear pattern yet. Keep leaving notes and this will sharpen.';
  }
  const list = (tags: string[]) => {
    const labels = tags.map(tagLabel);
    return labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  };
  const parts = [`From ${analyzed} ${analyzed === 1 ? 'note' : 'notes'}:`];
  if (drawnTo.length > 0) parts.push(`you respond to ${list(drawnTo)}`);
  if (putOffBy.length > 0) {
    parts.push(`${drawnTo.length > 0 ? 'and are' : 'you are'} put off by ${list(putOffBy)}`);
  }
  return parts.join(' ') + '.';
}
