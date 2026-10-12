import '../global.css';

import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { onReminderTapped, setupNotifications, syncAllReminders } from '@/lib/notifications';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();
setupNotifications();

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  // Reschedule alerts from the server list and open Plan when an alert is tapped.
  useEffect(() => {
    if (!userId) return;
    syncAllReminders().catch(() => {});
    return onReminderTapped(() => router.push('/plan'));
  }, [userId]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#020617' } }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
