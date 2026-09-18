import { StyleSheet } from 'react-native';

import { Screen } from './screen';
import { ThemedText } from './themed-text';

export function SetupRequired() {
  return (
    <Screen style={styles.center}>
      <ThemedText type="subtitle">Backend not linked</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.text}>
        Run <ThemedText type="code">npx convex dev</ThemedText> once to create a deployment and
        write <ThemedText type="code">EXPO_PUBLIC_CONVEX_URL</ThemedText> to{' '}
        <ThemedText type="code">.env.local</ThemedText>, then restart Expo.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  text: { textAlign: 'center' },
});
