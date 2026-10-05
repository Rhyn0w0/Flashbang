# Convex backend

Run `npm run convex` from the repo root. It links a deployment, writes deployment
settings to `backend/.env.local`, and regenerates `backend/convex/_generated/`.
Copy the deployment URL into `frontend/.env.local` as `EXPO_PUBLIC_CONVEX_URL`.

Set the TypeSafe AI key on the deployment:

```
npm run backend -- env set TYPESAFE_API_KEY YOUR_TYPESAFE_API_KEY
```

Clerk also requires `CLERK_JWT_ISSUER_DOMAIN` on the deployment. See the root
README for its setup. Use `npm run backend -- <command>` for codegen, deploy,
environment variables, and other Convex CLI commands.

The frontend imports generated API definitions through `@flashbang/backend/api`
and document types through `@flashbang/backend/types`. The shared domain module
`shared/profile-rules.ts` contains the age limits.

## Data flow

1. `comments.create` inserts a private comment, bumps `authorStats`, and schedules analysis.
2. `ai/analyzeComment` uses `@typesafe-ai/sdk` to ask Jev one Choice question for overall sentiment and one Choice per
   tag in `ai/tags.ts`, in a single call. Tag reactions map to −1, −0.5, 0, +0.5, or +1, with a separate unmentioned option.
   `comments.saveAnalysis` saves each interpretation's confidence and updates `tastes.preferences` atomically before scheduling ranking after 30 seconds. If the comment was on a photo it then runs
   `sentiment.rebuildForPhoto`, which recomputes `photoSentiment` for the owner from counts
   only and composes the summary sentence in code.
3. `ai/refinePicks` claims a comment-count revision only after the latest 40 notes have analysis and any preference migration has finished. It sends the cumulative tag sentiments and confidences, plus the latest 20 notes, to Jev to score up to 30 unseen active profiles in one call. It keeps up to ten profiles rated at least "good fit". New comments make an in-flight result stale; failures release the claim so a later run can retry, without rolling back preferences.

## Preference updates

`lib/taste.ts` accumulates three values per tag: evidence weight, weighted sentiment, and weighted squared sentiment.
A comment's interpretation confidence is its evidence weight. Sentiment is the weighted mean. Preference confidence is
`weight / (weight + 2) * (1 - variance)`, clamped to the valid range, where variance is the weighted variance of the observed sentiments.
This confidence measures evidence and agreement; it is not a calibrated probability of compatibility.
One fully certain comment gives confidence 1/3, and two consistent comments give 1/2. Equal opposing reactions of −1 and +1 give zero sentiment and zero confidence.
Repeated explicit neutrality can establish confidence in a neutral preference, while unmentioned tags retain their prior values.

All 26 tags are stored in the user's taste document, including unknown tags with zero sentiment, confidence, and evidence count.
The five preferred and five disliked tags in the summary are ranked by sentiment magnitude multiplied by confidence; ranking receives every tag with nonzero confidence.
Evidence survives beyond the 40-note ranking history. Duplicate analysis saves cannot apply the same comment twice, and updates commute when analysis finishes out of order.

On the first new analysis, `comments.backfillTagPreferences` adopts existing analysed notes in pages of 50. It maps their overall reactions to −0.5, 0, or +0.5 with interpretation confidence 0.25.
The saved `tagSentiments` field marks each migrated comment, so retries do not duplicate its evidence. Pending comments are left for normal Jev analysis.

Only the author can read comment text through `comments.mine`. Model calls go directly to TypeSafe AI through the shared client in `ai/model.ts`. SDK logging is disabled because request bodies contain private feedback. The direct SDK has no documented per-request zero data retention option.

Run `npm test` to check the matching loop with the real SDK and mocked HTTP responses. A live model check needs `TYPESAFE_API_KEY` and a configured Convex deployment.
