# Convex backend

Run `npm run convex` from the repo root. It links a deployment, writes deployment
settings to `backend/.env.local`, and regenerates `backend/convex/_generated/`.
Copy the deployment URL into `frontend/.env.local` as `EXPO_PUBLIC_CONVEX_URL`.

Set the AI Gateway key on the deployment, not in `.env`:

```
npm run backend -- env set AI_GATEWAY_API_KEY vck_...
```

Clerk also requires `CLERK_JWT_ISSUER_DOMAIN` on the deployment. See the root
README for its setup. Use `npm run backend -- <command>` for codegen, deploy,
environment variables, and other Convex CLI commands.

The frontend imports generated API definitions through `@flashbang/backend/api`
and document types through `@flashbang/backend/types`. The shared domain module
`shared/profile-rules.ts` contains the age limits.

## Data flow

1. `comments.create` inserts a private comment, bumps `authorStats`, and schedules two actions.
2. `ai/analyzeComment` asks Jev one choice question (sentiment) and one yes/no question per
   tag in `ai/tags.ts`, in a single call. If the comment was on a photo it then runs
   `sentiment.rebuildForPhoto`, which recomputes `photoSentiment` for the owner from counts
   only and composes the summary sentence in code.
3. `ai/refinePicks` (30 s later, one run per comment-count revision) derives the author's
   `tastes` row from their tags in code, then asks Jev to score every candidate in one call
   and writes the `picks` list.

Comment text is only ever read by its author (`comments.mine`) and by the model, with zero
data retention requested on every call.
