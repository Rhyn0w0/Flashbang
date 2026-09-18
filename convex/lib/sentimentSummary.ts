import { tagLabel } from '../ai/tags';

export type Counts = { positive: number; neutral: number; negative: number };

const total = (c: Counts) => c.positive + c.neutral + c.negative;

/**
 * The note shown to a photo's owner. Built from counts alone, so nothing a commenter wrote
 * can leak through it. Jev does not generate text, so this stays in code.
 */
export function composeSummary(overall: Counts, fromLikelyMatches: Counts, topTags: string[]) {
  const n = total(overall);
  if (n === 0) return 'No feedback yet.';

  const noun = n === 1 ? 'note' : 'notes';
  let lead: string;
  if (overall.positive / n >= 0.6) {
    lead = `Landing well: ${overall.positive} of ${n} ${noun} were positive.`;
  } else if (overall.negative / n >= 0.5) {
    lead = `Not landing yet: ${overall.negative} of ${n} ${noun} were negative.`;
  } else {
    lead = `Mixed: ${overall.positive} positive, ${overall.negative} negative, ${overall.neutral} neutral.`;
  }

  const parts = [lead];
  const m = total(fromLikelyMatches);
  if (m > 0) {
    const { positive, negative } = fromLikelyMatches;
    const lean =
      positive > negative ? 'lean positive' : negative > positive ? 'lean negative' : 'are split';
    parts.push(`People you are likely into ${lean}.`);
  }
  if (topTags.length > 0) {
    parts.push(`Common themes: ${topTags.slice(0, 3).map(tagLabel).join(', ')}.`);
  }
  return parts.join(' ');
}
