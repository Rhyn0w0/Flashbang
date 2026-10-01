import type { AuthConfig } from 'convex/server';

const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN;

if (!issuer) {
  throw new Error(
    'Set CLERK_JWT_ISSUER_DOMAIN on the Convex deployment to your Clerk Frontend API URL.'
  );
}

export default {
  providers: [{ domain: issuer, applicationID: 'convex' }],
} satisfies AuthConfig;
