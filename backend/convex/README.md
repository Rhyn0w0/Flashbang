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
2. `ai/analyzeComment` uses `@typesafe-ai/sdk` to ask Jev one choice question for sentiment and one Noul question per
   tag in `ai/tags.ts`, in a single call. Saving analysis schedules ranking after 30 seconds. If the comment was on a photo it then runs
   `sentiment.rebuildForPhoto`, which recomputes `photoSentiment` for the owner from counts
   only and composes the summary sentence in code.
3. `ai/refinePicks` claims a comment-count revision only after the latest 40 notes have analysis. It derives taste from positive and negative tag counts, then asks Jev to score up to 30 unseen active profiles in one call. It keeps up to ten profiles rated at least "good fit" and saves taste and picks together. New comments make an in-flight result stale; failures release the claim so a later run can retry.

Only the author can read comment text through `comments.mine`. Model calls go directly to TypeSafe AI through the shared client in `ai/model.ts`. SDK logging is disabled because request bodies contain private feedback. The direct SDK has no documented per-request zero data retention option.

Run `npm test` to check the matching loop with the real SDK and mocked HTTP responses. A live model check needs `TYPESAFE_API_KEY` and a configured Convex deployment.
