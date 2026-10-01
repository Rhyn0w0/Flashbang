import { SignIn } from '@clerk/expo/web';
import { StyleSheet } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/themed-text';

export default function SignInScreen() {
  return (
    <Screen style={styles.content}>
      <ThemedText type="title">Flashbang</ThemedText>
      <ThemedText themeColor="textSecondary">
        Find people through what catches your eye. Your comments stay private.
      </ThemedText>
      <SignIn routing="hash" withSignUp forceRedirectUrl="/" signUpForceRedirectUrl="/" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', maxWidth: 440 },
});
