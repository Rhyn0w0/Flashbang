import { useEffect, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from './themed-view';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = { children: ReactNode; style?: StyleProp<ViewStyle>; footer?: ReactNode };

/** Scrollable page body with safe-area, tab-bar inset, and centred max width. */
export function Screen({ children, style, footer }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const hasFooter = footer != null;
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());

  useEffect(() => {
    if (!hasFooter || Platform.OS === 'web') return;

    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [hasFooter]);

  const platformPadding = Platform.select({
    web: { paddingTop: Spacing.six + Spacing.four, paddingBottom: Spacing.four },
    default: {
      paddingTop: insets.top + Spacing.three,
      paddingBottom: footer ? Spacing.three : insets.bottom + BottomTabInset + Spacing.three,
    },
  });

  return (
    <KeyboardAvoidingView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      enabled={hasFooter && Platform.OS !== 'web'}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.background }]}
        contentContainerStyle={[styles.content, platformPadding]}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled">
        <ThemedView style={[styles.inner, style]}>{children}</ThemedView>
      </ScrollView>
      {footer ? (
        <ThemedView
          style={[
            styles.footer,
            {
              paddingBottom:
                Platform.OS === 'web' || keyboardVisible
                  ? Spacing.three
                  : insets.bottom +
                    (Platform.OS === 'android' ? BottomTabInset : 0) +
                    Spacing.three,
            },
          ]}>
          <ThemedView style={styles.inner}>{footer}</ThemedView>
        </ThemedView>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexDirection: 'row', justifyContent: 'center' },
  footer: { alignItems: 'center', paddingTop: Spacing.three },
  inner: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
});
