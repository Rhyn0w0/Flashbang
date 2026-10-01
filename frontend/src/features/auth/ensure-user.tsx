import { useAuth } from '@clerk/expo';
import { useConvexAuth, useMutation } from 'convex/react';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';

import { Button } from '@/components/ui/button';
import { ErrorText } from '@/components/ui/error-text';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/themed-text';
import { api } from '@flashbang/backend/api';

import SignInScreen from './sign-in-screen';
import { SignOutButton } from './sign-out-button';

/**
 * Creates the users row for a signed-in identity before rendering the app, so screens
 * never run protected queries until Convex accepts the Clerk session and the user row
 * exists. Keying the bootstrap on the session also resets it when accounts change.
 */
export function EnsureUser({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (!isLoaded) return <LoadingScreen message="Loading your account…" />;
  if (!isSignedIn) return <SignInScreen />;
  if (isLoading) return <LoadingScreen message="Connecting your account…" />;
  if (!isAuthenticated) {
    return (
      <Screen>
        <ThemedText type="subtitle">Unable to connect your account</ThemedText>
        <ThemedText themeColor="textSecondary">Sign out and try again.</ThemedText>
        <SignOutButton />
      </Screen>
    );
  }
  return <EnsureSignedInUser key={sessionId}>{children}</EnsureSignedInUser>;
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <Screen>
      <ActivityIndicator accessibilityLabel={message} />
      <ThemedText themeColor="textSecondary">{message}</ThemedText>
    </Screen>
  );
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
  if (!error) return <LoadingScreen message="Setting up your account…" />;
  return (
    <Screen>
      <ErrorText error={error} />
      <Button
        title="Retry"
        onPress={() => {
          setError(null);
          setAttempt((n) => n + 1);
        }}
      />
      <SignOutButton />
    </Screen>
  );
}
