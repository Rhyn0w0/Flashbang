# Flashbang

Flashbang is a dating app built for iOS, Android, and web.
It is made with Expo, hosted on Vercel, uses a Convex backend, and uses Vercel's AI SDK for an AI-powered matching algorithm.

The primary difference from other dating apps is that, rather than showing you people and having you click yes or no, you leave comments about each profile. Those comments help the AI narrow down what kind of people you're looking for, and it suggests more refined picks as you keep commenting. Comments are never visible to other users. Each user can see a summary of general sentiment towards each photo they post, and more specifically the sentiment from people the algorithm deems them likely to be attracted to.

## Stack

| Layer          | Choice                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------- |
| App            | Expo SDK 57, Expo Router, React Native (iOS, Android, web)                               |
| Backend        | Convex (database, file storage, scheduled actions)                                       |
| Authentication | Clerk (hosted auth on mobile, Clerk sign-in component on web)                            |
| AI             | Vercel AI SDK `evaluate` with Jev (TypeSafe AI, `typesafe-ai/jev`) via Vercel AI Gateway |
| Web hosting    | Vercel, static export of the Expo web build                                              |

## Getting started

```bash
npm install
npm run convex       # links the backend deployment; keep this terminal running
# Follow "Set up Clerk sign-in" below before signing in.
npm run backend -- env set AI_GATEWAY_API_KEY vck_...   # run in another terminal
npm start            # starts the frontend; then press i / a / w
```

Run commands from the repository root. npm workspaces keep the frontend and backend dependencies separate, with one installation and lockfile.

Convex stores deployment settings in `backend/.env.local`. Copy `frontend/.env.example` to `frontend/.env.local` and set `EXPO_PUBLIC_CONVEX_URL` to the deployment URL printed by Convex. Expo reads public configuration from the frontend folder.

`npm run convex` regenerates `backend/convex/_generated/`. Those files are committed, so a fresh checkout can run `npm run typecheck` after installing dependencies.

If you have no Convex account, `npm run convex` offers a local, account-free deployment.

## Set up Clerk sign-in

This checkout is configured for the **Flashbang** Clerk development application. The Clerk CLI links it through the repository's git remote. The issuer is `https://crucial-mudfish-5798.clerk.accounts.dev`, and Convex runs locally. Start `npm run convex` and `npm start` in separate terminals. Local settings are in the ignored `backend/.env.local` and `frontend/.env.local` files.

Email codes, passwords, and Google are enabled. Native API is enabled, the Android package `app.flashbang` is registered, and the hosted-auth callbacks `clerk://app.flashbang.hosted-callback` and `app.flashbang://callback` are allowed. Register the iOS app with your Apple App ID prefix and bundle identifier before creating a production build. Android passkeys also need the signing certificate fingerprint. Production Clerk and a cloud Convex deployment are not configured.

For a new checkout or a different Clerk application:

1. Create a **Flashbang** application in the [Clerk Dashboard](https://dashboard.clerk.com/). Enable the sign-in methods you want, such as email and password.
2. Copy the **Publishable key** from **API keys** into `frontend/.env.local`:

   ```dotenv
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```

3. Activate Clerk's [Convex integration](https://dashboard.clerk.com/setup/convex). Copy the **Frontend API URL**, including `https://`.
   Check that the Clerk JWT template named `convex` exists and has the claim `"aud": "convex"`. The current development app also includes the user's name and email in that template so `users.ensure` can store them.
4. Start `npm run convex` if you have not linked a deployment yet. It writes deployment settings to `backend/.env.local` and reports that `CLERK_JWT_ISSUER_DOMAIN` is missing. Leave it running, then set the URL in another terminal:

   ```bash
   npm run backend -- env set CLERK_JWT_ISSUER_DOMAIN https://your-app.clerk.accounts.dev
   ```

5. Convex deploys `backend/convex/auth.config.ts` when the issuer is set. Copy the backend deployment URL into `frontend/.env.local` as `EXPO_PUBLIC_CONVEX_URL`. Restart Expo after changing that file.
6. For iOS and Android, enable the **Native API** in Clerk's **Native applications** settings. Register the iOS app using your Apple App ID prefix and the bundle identifier `app.flashbang`. Register Android with namespace `android_app` and package name `app.flashbang`. Add `app.flashbang://callback` and `clerk://app.flashbang.hosted-callback` to the allowed redirect URLs. Build the app again after adding the Clerk config plugin so Android registers the hosted-auth callback. The Clerk plugin requires iOS 17 or later.

On mobile, **Sign in** and **Create account** open Clerk's hosted authentication page and return to the app after completion. `frontend/src/app/+native-intent.ts` sends Clerk's callback links to Discover so Expo Router does not treat them as page routes. Web uses Clerk's embedded sign-in component with account creation enabled. Both support the authentication methods and password recovery configured in Clerk. Web uses hash routing so verification steps work with the static Expo export. See [Clerk's Expo quickstart](https://clerk.com/docs/expo/getting-started/quickstart).

The app waits for Convex to validate the Clerk session, then calls `users.ensure` before opening Discover, Picks, or Me. **Sign out** is on Me. Signing out removes the app screens, and a new session runs account setup again. If either public environment variable is missing, the app shows the missing configuration instead of attempting to connect. Convex requires `CLERK_JWT_ISSUER_DOMAIN` before deploying the auth configuration.

No Clerk secret key is needed by this app. For production, use the production Clerk publishable key in Vercel and your mobile build environment. Set the production issuer on Convex with `npm run backend -- env set --prod CLERK_JWT_ISSUER_DOMAIN https://clerk.your-domain.com`, then run `npm run backend -- deploy`. Use matching Clerk instances for each environment. See [Convex's Clerk setup](https://docs.convex.dev/auth/clerk).

## Layout

```text
frontend/
  src/app/                   Expo Router entry points
  src/features/              auth, discover, picks, profile
  src/components/ui/         Buttons, fields, themed text, screen layout
  src/components/navigation/ Native and web tabs
  src/hooks/                 Theme and color scheme hooks
  src/constants/             Theme values
  src/lib/convex.ts           Convex client
  assets/                    App icons, splash images, tab icons
  tests/                     Native auth callback tests
  app.json                   Expo configuration
backend/
  convex/                    Schema, auth, queries, mutations
    ai/                      Comment analysis and recommendation actions
    lib/                     Backend helpers
    _generated/              Generated client API and types
shared/
  profile-rules.ts           Age limits used by both workspaces
scripts/
  check-structure.mjs         Import boundary check
package.json                 Workspace commands and common tools
vercel.json                  Web deployment configuration
```

Routes import feature screens. Features use the shared UI components. The frontend calls server functions through `@flashbang/backend/api` and imports document types from `@flashbang/backend/types`. Backend implementation files stay inside `backend/convex`. Shared code has no frontend or backend imports. `npm run check:structure` checks these boundaries and resolves source imports.

## How the loop works

1. Discover shows one profile. The user writes a note and taps Next.
2. `comments.create` stores the note privately and schedules two actions.
3. `ai/analyzeComment` asks Jev for the note's sentiment and which of a fixed set of generic tags it reacts to, all in one call.
4. `ai/refinePicks` derives the author's taste from their tags, then asks Jev to score a candidate pool against it and writes `picks`.
5. If the note was about a photo, the owner's sentiment summary is recomputed from counts only. "Likely matches" are commenters who appear in the owner's own picks above a threshold.

Jev is an evaluation model, not a text generator: it returns choices, scores, and probabilities. Every sentence a user sees (taste summary, pick reasons, photo feedback) is composed in code from those answers, so nothing a commenter wrote can be echoed back. Raw comment text is only ever readable by its author and the model, with zero data retention requested.

## Scripts

| Script                         | What it does                                   |
| ------------------------------ | ---------------------------------------------- |
| `npm start`                    | Expo dev server                                |
| `npm run convex`               | Convex dev server with live function reload    |
| `npm run backend -- <command>` | Convex CLI in the backend workspace            |
| `npm run build:web`            | Static web export to `frontend/dist/`          |
| `npm run typecheck`            | Type checks across both workspaces             |
| `npm test`                     | Native auth callback routing tests             |
| `npm run test:auth`            | Live Clerk and local Convex integration checks |
| `npm run check:structure`      | Source imports and frontend/backend boundaries |
| `npm run lint`                 | Expo ESLint rules across both workspaces       |

`npm run test:auth` requires a signed-in Clerk CLI, the configured development publishable key, and the local Convex server running. It creates temporary accounts, checks authentication, profile isolation, and photo ownership, then deletes its accounts, rows, and uploaded photo. It only targets the project-local Convex deployment and a Clerk development instance. It does not test browser interactions or AI matching. Set `AI_GATEWAY_API_KEY` on Convex before testing the AI loop.

## Deploying

- **Web:** import the repo into Vercel. `vercel.json` sets the build command and output directory. Add `EXPO_PUBLIC_CONVEX_URL` pointing at your production Convex deployment and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` for your production Clerk application.
- **Convex:** `npm run backend -- deploy`. Set `AI_GATEWAY_API_KEY` and `CLERK_JWT_ISSUER_DOMAIN` on the production deployment.
- **iOS / Android:** run EAS Build from `frontend/` (`npx eas build`). Not configured yet.

## Not done yet

- Photo-specific comments in the UI. The backend accepts `photoId` on a comment; Discover currently comments on the profile as a whole.
- Candidate selection is a flat scan of active profiles. Replace with vector search or filters once there are more than a few hundred users.
- Rate limiting on comment creation, and moderation of comment text.
