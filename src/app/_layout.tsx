import { ConvexProvider } from 'convex/react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { SetupRequired } from '@/components/setup-required';
import { convex } from '@/lib/convex';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  if (!convex) {
    return (
      <ThemeProvider value={theme}>
        <SetupRequired />
      </ThemeProvider>
    );
  }

  return (
    <ConvexProvider client={convex}>
      <ThemeProvider value={theme}>
        <AppTabs />
      </ThemeProvider>
    </ConvexProvider>
  );
}
