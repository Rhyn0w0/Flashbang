# Flashbang

Flashbang is a dating app built for iOS, Android, and web.
It is made with Expo, hosted on Vercel, uses a Convex backend, and uses Vercel's AI SDK for an AI-powered matching algorithm.

The primary difference from other dating apps is that, rather than showing you people and having you click yes or no, you leave comments about each profile. Those comments help the AI narrow down what kind of people you're looking for, and it suggests more refined picks as you keep commenting. Comments are never visible to other users. Each user can see a summary of general sentiment towards each photo they post, and more specifically the sentiment from people the algorithm deems them likely to be attracted to.

## Stack

| Layer       | Choice                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------- |
| App         | Expo SDK 57, Expo Router, React Native (iOS, Android, web)                               |
| Backend     | Convex (database, file storage, scheduled actions)                                       |
| AI          | Vercel AI SDK `evaluate` with Jev (TypeSafe AI, `typesafe-ai/jev`) via Vercel AI Gateway |
| Web hosting | Vercel, static export of the Expo web build                                              |

## Getting started

```bash
npm install
npx convex dev        # links a deployment, writes EXPO_PUBLIC_CONVEX_URL to .env.local
npx convex env set AI_GATEWAY_API_KEY vck_...   # from the Vercel dashboard, AI Gateway tab
npm start             # then press i / a / w
```

`npx convex dev` also regenerates `convex/_generated/`, and `expo start` writes `expo-env.d.ts`. Both are needed for `npm run typecheck`.

If you have no Convex account yet, `npx convex dev` offers a local, account-free deployment. That is enough for development.

## Layout

```
src/app/            Expo Router screens: index (Discover), picks, me
src/components/     Shared UI (Screen, ProfileCard, Button, TextField, tabs)
src/lib/convex.ts   Convex client
convex/schema.ts    Tables: users, profiles, photos, comments, tastes, picks, photoSentiment
convex/*.ts         Queries and mutations, grouped by table
convex/ai/          Actions that call the model (analyzeComment, refinePicks) and the tag vocabulary
convex/lib/         Auth helpers and the code that turns model answers into text
vercel.json         Web deploy config
```

## How the loop works

1. Discover shows one profile. The user writes a note and taps Next.
2. `comments.create` stores the note privately and schedules two actions.
3. `ai/analyzeComment` asks Jev for the note's sentiment and which of a fixed set of generic tags it reacts to, all in one call.
4. `ai/refinePicks` derives the author's taste from their tags, then asks Jev to score a candidate pool against it and writes `picks`.
5. If the note was about a photo, the owner's sentiment summary is recomputed from counts only. "Likely matches" are commenters who appear in the owner's own picks above a threshold.

Jev is an evaluation model, not a text generator: it returns choices, scores, and probabilities. Every sentence a user sees (taste summary, pick reasons, photo feedback) is composed in code from those answers, so nothing a commenter wrote can be echoed back. Raw comment text is only ever readable by its author and the model, with zero data retention requested.

## Scripts

| Script              | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm start`         | Expo dev server                                 |
| `npm run convex`    | Convex dev server with live function reload     |
| `npm run build:web` | Static web export to `dist/` (what Vercel runs) |
| `npm run typecheck` | `tsc --noEmit` across app and backend           |
| `npm run lint`      | Expo ESLint config                              |

## Deploying

- **Web:** import the repo into Vercel. `vercel.json` sets the build command and output directory. Add `EXPO_PUBLIC_CONVEX_URL` as a Vercel environment variable pointing at your production Convex deployment.
- **Convex:** `npx convex deploy`. Set `AI_GATEWAY_API_KEY` on the production deployment.
- **iOS / Android:** use EAS Build (`npx eas build`). Not configured yet.

## Not done yet

- **Authentication.** All server functions call `ctx.auth.getUserIdentity()`, so the app shows a sign-in prompt until an auth provider is wired in. Convex Auth or Clerk both work with Expo; after sign-in, call `users.ensure` once.
- Photo-specific comments in the UI. The backend accepts `photoId` on a comment; Discover currently comments on the profile as a whole.
- Candidate selection is a flat scan of active profiles. Replace with vector search or filters once there are more than a few hundred users.
- Rate limiting on comment creation, and moderation of comment text.
