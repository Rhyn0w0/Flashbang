/**
 * Fixed vocabulary of generic, non-identifying things a note can react to. Jev cannot
 * invent tags, so each comment is scored against every entry here as a yes/no question.
 * Keys double as display strings (hyphens become spaces).
 */
export const TAGS = {
  humor: 'being funny, witty, or joking around',
  warmth: 'being kind, warm, or caring',
  confidence: 'coming across as confident or self-assured',
  style: 'fashion sense or looking well put together',
  smile: 'their smile or expression',
  adventurous: 'travel, the outdoors, or trying new things',
  creative: 'art, music, or making things',
  ambitious: 'career, goals, or drive',
  playful: 'being playful, silly, or lighthearted',
  sincere: 'seeming genuine, honest, or down to earth',
  active: 'sports, fitness, or an active lifestyle',
  thoughtful: 'being curious, thoughtful, or well-read',
  'low-effort': 'the profile or photos feeling low effort',
  'showing-off': 'coming across as showing off or trying too hard',
} as const;

export type Tag = keyof typeof TAGS;

export const TAG_KEYS = Object.keys(TAGS) as Tag[];

export function isTag(value: string): value is Tag {
  return value in TAGS;
}

export function tagLabel(tag: string) {
  return tag.replace(/-/g, ' ');
}
