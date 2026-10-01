import { useHostedAuth, type HostedAuthMode } from '@clerk/expo/hosted-auth';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { ErrorText } from '@/components/ui/error-text';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/themed-text';

export default function SignInScreen() {
  const { startHostedAuth } = useHostedAuth();
  const [pending, setPending] = useState<HostedAuthMode | null>(null);
  const [error, setError] = useState<unknown>(null);

  const authenticate = async (mode: HostedAuthMode) => {
    setPending(mode);
    setError(null);
    try {
      await startHostedAuth({ mode });
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(null);
    }
  };

  return (
    <Screen style={styles.content}>
      <ThemedText type="title">Flashbang</ThemedText>
      <ThemedText themeColor="textSecondary">
        Find people through what catches your eye. Your comments stay private.
      </ThemedText>
      <Button
        title="Sign in"
        onPress={() => void authenticate('sign-in')}
        loading={pending === 'sign-in'}
        disabled={pending !== null}
      />
      <Button
        title="Create account"
        onPress={() => void authenticate('sign-up')}
        loading={pending === 'sign-up'}
        disabled={pending !== null}
      />
      <ErrorText error={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 440 },
});
