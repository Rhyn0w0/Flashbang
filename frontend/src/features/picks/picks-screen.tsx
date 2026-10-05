import { useQuery } from 'convex/react';
import { StyleSheet } from 'react-native';

import { ProfileCard } from '@/features/profile/profile-card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/themed-text';
import { ThemedView } from '@/components/ui/themed-view';
import { Spacing } from '@/constants/theme';
import { api } from '@flashbang/backend/api';

/** What the model currently thinks the user wants, and who it suggests. */
export default function PicksScreen() {
  const user = useQuery(api.users.current);
  const taste = useQuery(api.picks.taste);
  const picks = useQuery(api.picks.list, user ? {} : 'skip');
  const preferences = taste?.preferences
    ?.filter((preference) => preference.commentCount > 0)
    .sort((a, b) => b.confidence - a.confidence);

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
            {preferences?.length ? (
              <ThemedView type="backgroundElement" style={styles.preferences}>
                <ThemedText type="small" themeColor="textSecondary">
                  −1 means dislike, +1 means like. Confidence reflects how much your notes agree.
                </ThemedText>
                {preferences.map((preference) => (
                  <ThemedView
                    type="backgroundElement"
                    key={preference.tag}
                    style={styles.preference}>
                    <ThemedText type="small" style={styles.tag}>
                      {preference.tag.replace(/-/g, ' ')}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {preference.sentiment > 0 ? '+' : ''}
                      {preference.sentiment.toFixed(2)}
                      {' · '}
                      {Math.round(preference.confidence * 100)}% confidence
                    </ThemedText>
                  </ThemedView>
                ))}
              </ThemedView>
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
  preferences: { gap: Spacing.two, marginTop: Spacing.two },
  preference: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  tag: { textTransform: 'capitalize' },
  pick: { gap: Spacing.two },
});
