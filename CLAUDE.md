@AGENTS.md

# Flashbang

Dating app: users leave private comments on profiles instead of swiping. An AI reads the
comments to refine picks and to produce per-photo sentiment summaries. See README.md.

## Layout

- `frontend/src/app/` contains Expo Router entry points for Discover, Picks, and Me.
- `frontend/src/features/` contains auth, discover, picks, and profile modules.
- `frontend/src/components/ui/` and `navigation/` contain shared UI and platform-specific tabs.
- `backend/convex/` contains the schema, authentication, functions, and generated client API.
- `backend/convex/ai/` is the only place actions call Jev through Vercel AI Gateway.
- `shared/profile-rules.ts` contains age limits for the profile form and server mutation.
- `scripts/check-structure.mjs` resolves imports and checks frontend/backend boundaries.
- `vercel.json` configures the web export to `frontend/dist/`.

## Commands

- `npm start` runs the Expo dev server. Use `npm run web`, `ios`, or `android` for a platform.
- `npm run convex` runs Convex and regenerates `backend/convex/_generated/`.
- `npm run backend -- <command>` runs another Convex command in the backend workspace.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run check:structure` verify the project.

Run commands from the repository root. Public Expo configuration belongs in
`frontend/.env.local`. Convex deployment selection belongs in `backend/.env.local`.

## Rules

- Comments are private. Never return raw comment text to anyone but the author. Only aggregated sentiment leaves the server.
- Frontend code imports only `@flashbang/backend/api` and `@flashbang/backend/types` from the backend. Shared code stays free of platform imports.
- Model calls go through `backend/convex/ai/model.ts`; do not instantiate providers elsewhere.
- Jev returns choices, scores, and probabilities. User-facing prose is composed in `backend/convex/lib/taste.ts` and `sentimentSummary.ts`; tags come from `backend/convex/ai/tags.ts`.
