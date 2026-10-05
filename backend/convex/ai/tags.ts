/**
 * Fixed vocabulary of generic, non-identifying things a note can react to. Jev cannot
 * invent tags, so each comment is judged against every entry here independently.
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
  communication: 'communicating clearly, listening, or having good conversations',
  reliable: 'being dependable, consistent, or following through',
  'emotionally-open': 'sharing feelings or being emotionally available',
  independent: 'having their own interests and being comfortable doing things alone',
  affectionate: 'expressing affection or enjoying physical closeness',
  introverted: 'preferring quiet time or smaller social settings',
  sociable: 'enjoying meeting people, groups, or a busy social life',
  spontaneous: 'enjoying unplanned activities or last-minute plans',
  'family-oriented': 'valuing family relationships or wanting a family',
  'long-term-relationship': 'explicitly wanting a committed, long-term relationship',
  'casual-dating': 'explicitly wanting casual dating or a relationship without commitment',
  pets: 'having pets or enjoying spending time with animals',
  'low-effort': 'the profile or photos feeling low effort',
  'showing-off': 'coming across as showing off or trying too hard',
} as const;

export type Tag = keyof typeof TAGS;

export const TAG_KEYS = Object.keys(TAGS).filter(isTag);

export function isTag(value: string): value is Tag {
  return Object.hasOwn(TAGS, value);
}

export function tagLabel(tag: string) {
  return tag.replace(/-/g, ' ');
}
