import { ThemedText } from './themed-text';

/** Inline error line. Alert.alert is a no-op on web, so errors go in the layout instead. */
export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <ThemedText type="small" style={{ color: '#d3302f' }} accessibilityRole="alert">
      {message}
    </ThemedText>
  );
}
