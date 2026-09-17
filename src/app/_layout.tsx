import { ConvexProvider, useConvexAuth, useMutation } from 'convex/react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { SetupRequired } from '@/components/setup-required';
import { api } from '@/convex/_generated/api';
import { convex } from '@/lib/convex';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  if (!convex) {
    return (
      <ThemeProvider value={theme}>
        <SetupRequired />
      </ThemeProvider>
    );
  }

  return (
    <ConvexProvider client={convex}>
      <ThemeProvider value={theme}>
        <EnsureUser />
        <AppTabs />
      </ThemeProvider>
    </ConvexProvider>
  );
}

/** Creates the users row for a signed-in identity. Idempotent; no-op while signed out. */
function EnsureUser() {
  const { isAuthenticated } = useConvexAuth();
  const ensure = useMutation(api.users.ensure);
  useEffect(() => {
    if (isAuthenticated) ensure().catch(console.error);
  }, [isAuthenticated, ensure]);
  return null;
}
