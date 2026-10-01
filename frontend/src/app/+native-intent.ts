/** Keep Clerk's native callback URLs out of Expo Router's page navigation. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, 'flashbang://app');
    if (
      (url.protocol === 'app.flashbang:' && url.hostname === 'callback') ||
      (url.protocol === 'clerk:' && url.hostname === 'app.flashbang.hosted-callback') ||
      url.pathname === '/hosted-auth-callback' ||
      url.pathname === '/--/hosted-auth-callback'
    ) {
      return '/';
    }
    return path;
  } catch {
    return '/';
  }
}
