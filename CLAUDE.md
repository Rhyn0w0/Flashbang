@AGENTS.md

# Flashbang

Dating app: users leave private comments on profiles instead of swiping. An AI reads the
comments to refine picks and to produce per-photo sentiment summaries. See README.md.

## Layout

- `src/app/` — Expo Router screens (`index` discover, `picks`, `me`). `src/components/`, `src/hooks/`, `src/constants/` hold shared UI.
- `src/convex/` does not exist; the backend lives in `convex/` at the repo root (Convex convention).
- `convex/schema.ts` — tables. `convex/ai/` — Vercel AI SDK `evaluate` calls to Jev (TypeSafe AI) through Vercel AI Gateway. Actions in `convex/ai/` are the only place the model is called.
- `vercel.json` — web deploy (`expo export --platform web` → `dist/`).

## Commands

- `npm start` — Expo dev server. `npm run web` / `ios` / `android`.
- `npx convex dev` — run Convex locally and regenerate `convex/_generated/`.
- `npm run typecheck`, `npm run lint`.

## Rules

- Comments are private. Never return raw comment text to anyone but the author. Only aggregated sentiment leaves the server.
- Model calls go through `convex/ai/model.ts`; do not instantiate providers elsewhere.
- Jev is an evaluation model: it answers choice/score/boolean questions and never generates text. Any prose shown to users is composed in code (`convex/lib/taste.ts`, `convex/lib/sentimentSummary.ts`), and tags come from the fixed vocabulary in `convex/ai/tags.ts`.
