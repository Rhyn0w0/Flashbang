import { useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ErrorText } from '@/components/error-text';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';

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
      {profile ? <Photos /> : null}
    </Screen>
  );
}

function ProfileForm({ profile }: { profile: Doc<'profiles'> | null }) {
  const upsert = useMutation(api.profiles.upsertMine);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [age, setAge] = useState(profile ? String(profile.age) : '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const save = async () => {
    const parsedAge = Number.parseInt(age, 10);
    if (!displayName.trim() || Number.isNaN(parsedAge)) {
      setError(new Error('Name and age are required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await upsert({
        displayName: displayName.trim(),
        age: parsedAge,
        bio,
        city: city || undefined,
      });
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TextField placeholder="Name" value={displayName} onChangeText={setDisplayName} />
      <TextField placeholder="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
      <TextField placeholder="City (optional)" value={city} onChangeText={setCity} />
      <TextField placeholder="Bio" value={bio} onChangeText={setBio} multiline />
      <ErrorText error={error} />
      <Button title={profile ? 'Save' : 'Create profile'} onPress={save} loading={saving} />
    </>
  );
}

function Photos() {
  const photos = useQuery(api.photos.mine);
  const sentiment = useQuery(api.sentiment.forMyPhotos);
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const addPhoto = useMutation(api.photos.add);
  const removePhoto = useMutation(api.photos.remove);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const byPhoto = new Map((sentiment ?? []).map((s) => [s.photoId, s]));

  const pickAndUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled) return;
    setUploading(true);
    setError(null);
    try {
      const asset = result.assets[0];
      const blob = await (await fetch(asset.uri)).blob();
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': asset.mimeType ?? 'image/jpeg' },
        body: blob,
      });
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      const { storageId } = await response.json();
      await addPhoto({ storageId });
    } catch (caught) {
      setError(caught);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.photos}>
      <ThemedText type="smallBold">Photos</ThemedText>
      {photos?.map((photo) => {
        const s = byPhoto.get(photo._id);
        return (
          <ThemedView key={photo._id} type="backgroundElement" style={styles.photoRow}>
            {photo.url ? <Image source={{ uri: photo.url }} style={styles.thumb} /> : null}
            <View style={styles.photoMeta}>
              <ThemedText type="small">{s ? s.summary : 'No feedback yet.'}</ThemedText>
              {s ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Likely matches: {s.fromLikelyMatches.positive} up · {s.fromLikelyMatches.negative}{' '}
                  down
                </ThemedText>
              ) : null}
              <Pressable onPress={() => removePhoto({ photoId: photo._id }).catch(setError)}>
                <ThemedText type="link" themeColor="textSecondary">
                  Remove
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        );
      })}
      <ErrorText error={error} />
      <Button title="Add photo" onPress={pickAndUpload} loading={uploading} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  photos: { gap: Spacing.two, marginTop: Spacing.three },
  photoRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
  thumb: { width: 96, height: 120, borderRadius: Spacing.two },
  photoMeta: { flex: 1, gap: Spacing.one, justifyContent: 'center' },
});
