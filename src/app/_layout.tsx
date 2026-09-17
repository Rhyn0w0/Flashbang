import { ConvexProvider, useConvexAuth, useMutation } from 'convex/react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { Button } from '@/components/button';
import { ErrorText } from '@/components/error-text';
import { Screen } from '@/components/screen';
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
        <EnsureUser>
          <AppTabs />
        </EnsureUser>
      </ThemeProvider>
    </ConvexProvider>
  );
}

/**
 * Creates the users row for a signed-in identity before rendering the app, so screens
 * never see `users.current === null` for a signed-in user. Renders immediately while
 * signed out, since there is nothing to create. The signed-in branch is a separate
 * component so its state is discarded on sign-out and rebuilt for the next identity.
 */
function EnsureUser({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  if (!isAuthenticated) return children;
  return <EnsureSignedInUser>{children}</EnsureSignedInUser>;
}

function EnsureSignedInUser({ children }: { children: ReactNode }) {
  const ensure = useMutation(api.users.ensure);
  const [ensured, setEnsured] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    ensure()
      .then(() => !cancelled && setEnsured(true))
      .catch((caught) => !cancelled && setError(caught));
    return () => {
      cancelled = true;
    };
  }, [ensure, attempt]);

  if (ensured) return children;
  return (
    <Screen>
      <ErrorText error={error} />
      {error ? (
        <Button
          title="Retry"
          onPress={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        />
      ) : null}
    </Screen>
  );
}
