# Convex backend

Run `npx convex dev` from the repo root. It links a deployment, writes
`EXPO_PUBLIC_CONVEX_URL` to `.env.local`, and regenerates `_generated/`.

Set the model key on the deployment, not in `.env`:

```
npx convex env set ANTHROPIC_API_KEY sk-ant-...
```

## Data flow

1. `comments.create` inserts a private comment and schedules two actions.
2. `ai/analyzeComment` labels sentiment and tags, then (if the comment was on a photo)
   schedules `ai/summarizePhoto`.
3. `ai/refinePicks` rebuilds the author's `tastes` row and `picks` list.
4. `ai/summarizePhoto` recomputes `photoSentiment` for the owner from counts only.

Comment text is only ever read by its author (`comments.mine`) and by the model.
