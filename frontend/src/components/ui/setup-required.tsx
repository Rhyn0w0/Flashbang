import { StyleSheet } from 'react-native';

import { Screen } from './screen';
import { ThemedText } from './themed-text';

export function SetupRequired({ missingKeys }: { missingKeys: string[] }) {
  return (
    <Screen style={styles.center}>
      <ThemedText type="subtitle">Finish setting up Flashbang</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.text}>
        Add these values to <ThemedText type="code">frontend/.env.local</ThemedText>, then restart Expo:
      </ThemedText>
      {missingKeys.map((key) => (
        <ThemedText key={key} type="code">
          {key}
        </ThemedText>
      ))}
      <ThemedText themeColor="textSecondary" style={styles.text}>
        See the Clerk sign-in setup in the README for the steps.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  text: { textAlign: 'center' },
});
