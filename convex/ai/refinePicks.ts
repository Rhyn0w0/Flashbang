import { experimental_evaluate as evaluate, type Experimental_EvaluationQuestion } from 'ai';
import type { FunctionReturnType } from 'convex/server';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { internalAction } from '../_generated/server';
import { deriveTaste } from '../lib/taste';
import { model, providerOptions } from './model';
import { isTag, TAGS, tagLabel } from './tags';

const COMMENT_HISTORY = 40;
const NOTES_SHOWN_TO_MODEL = 20;
const CANDIDATE_POOL = 30;
const MAX_PICKS = 10;

// Ordered lowest to highest. The answer's score is interpolated across these rungs.
const FIT_LEVELS = [
  'poor fit: shows traits that put the user off, or nothing they respond to',
  'weak fit: little overlap with what the user responds to',
  'good fit: clear overlap with what the user responds to',
  'strong fit: shows several traits the user responds to and none that put them off',
];
// Keep candidates rated "good fit" or better.
const MIN_FIT = 0.5;

type Candidates = FunctionReturnType<typeof internal.profiles.listCandidates>;
type Taste = ReturnType<typeof deriveTaste>;

/**
 * Rebuilds a user's taste profile and picks. The taste is pure tag arithmetic over their
 * analysed notes (see lib/taste). The ranking is one Jev call: every candidate is scored
 * against the taste and recent notes in parallel. Scheduled after every new comment with a
 * short delay so bursts of comments only trigger one rebuild.
 * Naive on purpose; swap the candidate pool for a vector search when it grows.
 */
export const run = internalAction({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    // Runs are scheduled with a delay, so several comments in a row collapse into one
    // rebuild: the claim is granted to exactly one run per comment-count revision. Comments
    // that land while this run is in flight have already scheduled their own run.
    const totalComments = await ctx.runMutation(internal.picks.claimRefine, { userId });
    if (totalComments === null) return;

    const history = await ctx.runQuery(internal.comments.recentByAuthor, {
      authorId: userId,
      limit: COMMENT_HISTORY,
    });

    const taste = deriveTaste(history);
    await ctx.runMutation(internal.picks.saveTaste, {
      userId,
      ...taste,
      commentCount: totalComments,
    });

    const candidates = await ctx.runQuery(internal.profiles.listCandidates, {
      forUserId: userId,
      limit: CANDIDATE_POOL,
    });

    // With no candidates the pick set is replaced with nothing, which still marks this
    // revision as refined so the next run does not redo the work.
    const picks = candidates.length === 0 ? [] : await rankCandidates(taste, history, candidates);

    await ctx.runMutation(internal.picks.replaceAll, {
      userId,
      commentCount: totalComments,
      picks,
    });
  },
});

async function rankCandidates(
  taste: Taste,
  history: FunctionReturnType<typeof internal.comments.recentByAuthor>,
  candidates: Candidates
) {
  const drawnTo = taste.drawnTo.filter(isTag);
  const traitCriteria = {
    ...Object.fromEntries(drawnTo.map((tag) => [tag, TAGS[tag]])),
    none: 'none of these come through',
  };

  const questions: Record<string, Experimental_EvaluationQuestion> = {};
  candidates.forEach((_, i) => {
    questions[`fit_${i}`] = {
      type: 'score',
      instructions: `How well does candidate ${i} fit what this user is looking for, judging from their taste and the notes they wrote about other profiles?`,
      criteria: FIT_LEVELS,
    };
    if (drawnTo.length > 0) {
      questions[`trait_${i}`] = {
        type: 'choice',
        instructions: `Which of the traits this user responds to does candidate ${i} most clearly show?`,
        criteria: traitCriteria,
      };
    }
  });

  const { answers } = await evaluate({
    model,
    providerOptions,
    state: {
      taste: { drawnTo: taste.drawnTo, putOffBy: taste.putOffBy },
      notesTheUserWroteAboutOtherProfiles: history
        .slice(0, NOTES_SHOWN_TO_MODEL)
        .map((h) => ({ sentiment: h.sentiment ?? null, note: h.body })),
      candidates: candidates.map((c, index) => ({ index, age: c.age, city: c.city, bio: c.bio })),
    },
    questions,
  });

  return candidates
    .map((candidate, i) => {
      const fit = answers[`fit_${i}`];
      const trait = answers[`trait_${i}`];
      const score = fit?.type === 'score' ? fit.score / (FIT_LEVELS.length - 1) : 0;
      const shown = trait?.type === 'choice' && trait.choice !== 'none' ? trait.choice : null;
      const reason = shown
        ? `Shows ${tagLabel(shown)}, which you tend to respond to.`
        : 'Fits the pattern in your notes.';
      return { profileId: candidate._id, score: Math.min(1, Math.max(0, score)), reason };
    })
    .filter((p) => p.score >= MIN_FIT)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PICKS);
}
