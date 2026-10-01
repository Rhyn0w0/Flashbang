import { useClerk } from '@clerk/expo';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorText } from '@/components/ui/error-text';

export function SignOutButton() {
  const { signOut } = useClerk();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const handleSignOut = async () => {
    setPending(true);
    setError(null);
    try {
      await signOut();
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button title="Sign out" onPress={() => void handleSignOut()} loading={pending} />
      <ErrorText error={error} />
    </>
  );
}
