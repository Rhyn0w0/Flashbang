import { useQuery } from 'convex/react';
import { StyleSheet } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/themed-text';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { api } from '@flashbang/backend/api';

import { ProfileForm } from './profile-form';
import { ProfilePhotos } from './profile-photos';

/** Own profile: details, photos, and the sentiment summary for each photo. */
export default function MeScreen() {
  const user = useQuery(api.users.current);
  const profile = useQuery(api.profiles.mine);

  if (user === undefined || profile === undefined) return <Screen>{null}</Screen>;
  if (user === null) {
    return (
      <Screen style={styles.center}>
        <ThemedText type="subtitle">Sign in to set up your profile</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <ThemedText type="subtitle">{profile ? 'Your profile' : 'Create your profile'}</ThemedText>
      {/* Keyed on the profile id so the form re-initialises when the server row changes. */}
      <ProfileForm key={profile?._id ?? 'new'} profile={profile} />
      {profile ? <ProfilePhotos /> : null}
      <SignOutButton />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
});
