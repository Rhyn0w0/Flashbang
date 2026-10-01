import { useMutation } from 'convex/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorText } from '@/components/ui/error-text';
import { TextField } from '@/components/ui/text-field';
import { api } from '@flashbang/backend/api';
import type { Doc } from '@flashbang/backend/types';
import { MIN_AGE } from '@shared/profile-rules';

export function ProfileForm({ profile }: { profile: Doc<'profiles'> | null }) {
  const upsert = useMutation(api.profiles.upsertMine);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [age, setAge] = useState(profile ? String(profile.age) : '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const save = async () => {
    const parsedAge = Number(age);
    if (!displayName.trim() || !Number.isInteger(parsedAge) || parsedAge < MIN_AGE) {
      setError(new Error(`Name and a whole-number age (${MIN_AGE}+) are required`));
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
