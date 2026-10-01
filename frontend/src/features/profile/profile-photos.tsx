import { useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ErrorText } from '@/components/ui/error-text';
import { ThemedText } from '@/components/ui/themed-text';
import { ThemedView } from '@/components/ui/themed-view';
import { Spacing } from '@/constants/theme';
import { api } from '@flashbang/backend/api';

export function ProfilePhotos() {
  const photos = useQuery(api.photos.mine);
  const sentiment = useQuery(api.sentiment.forMyPhotos);
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const addPhoto = useMutation(api.photos.add);
  const removePhoto = useMutation(api.photos.remove);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const byPhoto = new Map((sentiment ?? []).map((s) => [s.photoId, s]));

  const upload = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading(true);
    setError(null);
    try {
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

  const pickAndUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled) await upload(result.assets[0]);
  };

  // Android may destroy the activity while the picker is open; recover that selection.
  useEffect(() => {
    ImagePicker.getPendingResultAsync().then((pending) => {
      if (pending && !('code' in pending) && !pending.canceled) void upload(pending.assets[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

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
