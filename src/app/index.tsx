import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ErrorText } from '@/components/error-text';
import { ProfileCard } from '@/components/profile-card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';

/**
 * Discover: one profile at a time. Instead of yes/no, the user writes a note.
 * Submitting the note advances to the next profile and feeds the recommender.
 */
export default function DiscoverScreen() {
  const user = useQuery(api.users.current);
  const next = useQuery(api.picks.next);
  const createComment = useMutation(api.comments.create);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (user === undefined || next === undefined) return <Screen>{null}</Screen>;

  if (user === null) {
    return (
      <Screen style={styles.center}>
        <ThemedText type="subtitle">Sign in to start</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          Auth is not wired up yet. See the README for the next step.
        </ThemedText>
      </Screen>
    );
  }

  if (next === null) {
    return (
      <Screen style={styles.center}>
        <ThemedText type="subtitle">Nobody new right now</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          Check back later, or add photos to your own profile.
        </ThemedText>
      </Screen>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await createComment({ targetProfileId: next.profile._id, body });
      setBody('');
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <ProfileCard profile={next.profile} />
      {next.pick ? (
        <ThemedView type="backgroundElement" style={styles.reason}>
          <ThemedText type="small" themeColor="textSecondary">
            Picked for you
          </ThemedText>
          <ThemedText type="small">{next.pick.reason}</ThemedText>
        </ThemedView>
      ) : null}
      <TextField
        multiline
        value={body}
        onChangeText={setBody}
        placeholder="What do you think? Only you and the algorithm will ever read this."
      />
      <ErrorText error={error} />
      <Button title="Next" onPress={submit} disabled={!body.trim()} loading={submitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  centerText: { textAlign: 'center' },
  reason: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
});
