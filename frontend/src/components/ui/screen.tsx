import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from './themed-view';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = { children: ReactNode; style?: StyleProp<ViewStyle> };

/** Scrollable page body with safe-area, tab-bar inset, and centred max width. */
export function Screen({ children, style }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const platformPadding = Platform.select({
    web: { paddingTop: Spacing.six + Spacing.four, paddingBottom: Spacing.four },
    default: {
      paddingTop: insets.top + Spacing.three,
      paddingBottom: insets.bottom + BottomTabInset + Spacing.three,
    },
  });

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, platformPadding]}
      keyboardShouldPersistTaps="handled">
      <ThemedView style={[styles.inner, style]}>{children}</ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexDirection: 'row', justifyContent: 'center' },
  inner: {
    flexGrow: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
});
