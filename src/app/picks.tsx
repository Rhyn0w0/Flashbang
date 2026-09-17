import { useQuery } from 'convex/react';
import { StyleSheet } from 'react-native';

import { ProfileCard } from '@/components/profile-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';

/** What the model currently thinks the user wants, and who it suggests. */
export default function PicksScreen() {
  const user = useQuery(api.users.current);
  const taste = useQuery(api.picks.taste);
  const picks = useQuery(api.picks.list, user ? {} : 'skip');

  if (user === undefined) return <Screen>{null}</Screen>;
  if (user === null) {
    return (
      <Screen style={styles.center}>
        <ThemedText type="subtitle">Sign in to see picks</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <ThemedText type="subtitle">Your picks</ThemedText>

      <ThemedView type="backgroundElement" style={styles.taste}>
        <ThemedText type="smallBold">What we think you like</ThemedText>
        {taste ? (
          <>
            <ThemedText type="small">{taste.summary}</ThemedText>
            {taste.drawnTo.length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Drawn to: {taste.drawnTo.join(', ')}
              </ThemedText>
            ) : null}
            {taste.putOffBy.length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Put off by: {taste.putOffBy.join(', ')}
              </ThemedText>
            ) : null}
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Leave a few comments on Discover and this fills in.
          </ThemedText>
        )}
      </ThemedView>

      {picks?.map((pick) => (
        <ThemedView key={pick._id} style={styles.pick}>
          <ProfileCard profile={pick.profile} />
          <ThemedText type="small" themeColor="textSecondary">
            {Math.round(pick.score * 100)}% · {pick.reason}
          </ThemedText>
        </ThemedView>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  taste: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  pick: { gap: Spacing.two },
});
