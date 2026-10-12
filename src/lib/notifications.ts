import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Reminder } from '@/types/db';

import { listOpenReminders } from './db';
import { notificationSchedule } from './reminders';

const CHANNEL_ID = 'reminders';

export function setupNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => {});
  }
}

function isAllowed(status: Notifications.NotificationPermissionsStatus): boolean {
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** Asks for permission if it hasn't been decided yet. Returns whether alerts can be shown. */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (isAllowed(current)) return true;
  if (!current.canAskAgain) return false;
  return isAllowed(await Notifications.requestPermissionsAsync());
}

/**
 * Makes the phone's scheduled notifications match `reminders`. The reminder id is the
 * notification identifier, so edits, deletes and Done are all handled by re-syncing.
 */
export async function syncReminderNotifications(reminders: Reminder[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const wanted = new Map(notificationSchedule(reminders, new Date()).map((w) => [w.id, w]));

  for (const s of await Notifications.getAllScheduledNotificationsAsync()) {
    const w = wanted.get(s.identifier);
    const unchanged =
      w != null &&
      s.content.title === w.title &&
      s.content.body === w.body &&
      s.content.data?.fireAt === w.fireAt.toISOString();
    if (unchanged) wanted.delete(s.identifier);
    else await Notifications.cancelScheduledNotificationAsync(s.identifier);
  }

  for (const w of wanted.values()) {
    await Notifications.scheduleNotificationAsync({
      identifier: w.id,
      content: { title: w.title, body: w.body, data: { fireAt: w.fireAt.toISOString() } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: w.fireAt, channelId: CHANNEL_ID },
    });
  }
}

export async function syncAllReminders(): Promise<void> {
  await syncReminderNotifications(await listOpenReminders());
}

export async function clearReminderNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Calls `open` when a reminder notification is tapped, including the tap that launched the app. */
export function onReminderTapped(open: () => void): () => void {
  if (Notifications.getLastNotificationResponse()) {
    Notifications.clearLastNotificationResponse();
    open();
  }
  const sub = Notifications.addNotificationResponseReceivedListener(() => open());
  return () => sub.remove();
}
