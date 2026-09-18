import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';

export type PublicProfile = {
  displayName: string;
  age: number;
  bio: string;
  city?: string;
  photos: { _id: string; url: string | null }[];
};

export function ProfileCard({ profile }: { profile: PublicProfile }) {
  const hero = profile.photos.find((p) => p.url)?.url;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {hero ? (
        <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" />
      ) : (
        <ThemedView type="backgroundSelected" style={[styles.hero, styles.placeholder]}>
          <ThemedText themeColor="textSecondary">No photos yet</ThemedText>
        </ThemedView>
      )}
      <View style={styles.body}>
        <ThemedText type="subtitle">
          {profile.displayName}, {profile.age}
        </ThemedText>
        {profile.city ? <ThemedText themeColor="textSecondary">{profile.city}</ThemedText> : null}
        <ThemedText>{profile.bio}</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.four, overflow: 'hidden' },
  hero: { width: '100%', aspectRatio: 4 / 5 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.three, gap: Spacing.one },
});
