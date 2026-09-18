import { ConvexReactClient } from 'convex/react';

const url = process.env.EXPO_PUBLIC_CONVEX_URL;

/**
 * Null when EXPO_PUBLIC_CONVEX_URL is unset so the app still renders (with a
 * setup hint) before `npx convex dev` has been run.
 */
export const convex = url ? new ConvexReactClient(url, { unsavedChangesWarning: false }) : null;
