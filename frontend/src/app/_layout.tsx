import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/navigation/app-tabs';
import { SetupRequired } from '@/components/ui/setup-required';
import { EnsureUser } from '@/features/auth/ensure-user';
import { convex } from '@/lib/convex';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  if (!convex || !publishableKey) {
    return (
      <ThemeProvider value={theme}>
        <SetupRequired
          missingKeys={[
            ...(!convex ? ['EXPO_PUBLIC_CONVEX_URL'] : []),
            ...(!publishableKey ? ['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY'] : []),
          ]}
        />
      </ThemeProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ThemeProvider value={theme}>
          <EnsureUser>
            <AppTabs />
          </EnsureUser>
        </ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
