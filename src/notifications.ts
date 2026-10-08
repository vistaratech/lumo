import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotificationPrefs {
  enabled: boolean;
  nightReminder: boolean;
  morningDigest: boolean;
  timerAlerts: boolean;
  pushToken: string | null;
  permissionGranted: boolean;
}

const STORAGE_KEY_PREFS = 'lumo.notification_prefs';
const STORAGE_KEY_PUSH_TOKEN = 'lumo.push_token';

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  nightReminder: true,
  morningDigest: true,
  timerAlerts: true,
  pushToken: null,
  permissionGranted: false,
};

// Set global notification foreground presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Configure Android notification channels for high visibility
 */
export async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('lumo-alerts', {
      name: 'Lumo Home Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF9F1C',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });

    await Notifications.setNotificationChannelAsync('lumo-reminders', {
      name: 'Lumo Daily Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 200, 200],
      lightColor: '#8B5CF6',
      sound: 'default',
    });
  }
}

/**
 * Request notification permissions and register for Expo Push Token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    await setupNotificationChannels();

    if (!Device.isDevice) {
      console.log('[Notifications] Running in simulator/emulator. Push notifications require a physical device.');
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted by user.');
      await updateStoredPrefs({ permissionGranted: false });
      return null;
    }

    await updateStoredPrefs({ permissionGranted: true });

    // Fetch Expo Push Token
    let token: string | null = null;
    try {
      const pushTokenData = await Notifications.getExpoPushTokenAsync();
      token = pushTokenData.data;
      if (token) {
        await AsyncStorage.setItem(STORAGE_KEY_PUSH_TOKEN, token);
        await updateStoredPrefs({ pushToken: token });
        console.log('[Notifications] Expo Push Token registered:', token);
      }
    } catch (e) {
      console.log('[Notifications] Could not fetch Expo push token (offline or development build):', e);
    }

    return token;
  } catch (err) {
    console.error('[Notifications] Error registering for push notifications:', err);
    return null;
  }
}

/**
 * Load user notification preferences from AsyncStorage
 */
export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_PREFS);
    const token = await AsyncStorage.getItem(STORAGE_KEY_PUSH_TOKEN);
    const { status } = await Notifications.getPermissionsAsync();

    if (raw) {
      const parsed: NotificationPrefs = JSON.parse(raw);
      return {
        ...DEFAULT_PREFS,
        ...parsed,
        pushToken: token || parsed.pushToken,
        permissionGranted: status === 'granted',
      };
    }
    return {
      ...DEFAULT_PREFS,
      pushToken: token,
      permissionGranted: status === 'granted',
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * Update and persist notification preferences
 */
export async function updateStoredPrefs(partial: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
  try {
    const current = await getNotificationPrefs();
    const updated = { ...current, ...partial };
    await AsyncStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(updated));
    await scheduleSmartReminders(updated);
    return updated;
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * Schedule recurring Daily Smart Reminders:
 * 1. 10:00 PM (22:00) Night Sleep-check
 * 2. 08:00 AM (08:00) Morning Good Morning Digest
 */
export async function scheduleSmartReminders(prefs?: NotificationPrefs) {
  try {
    const p = prefs || (await getNotificationPrefs());
    await Notifications.cancelAllScheduledNotificationsAsync();

    if (!p.enabled) return;

    // 1. Night Sleep-Check Reminder (10:00 PM)
    if (p.nightReminder) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌙 Lumo Night Check',
          body: 'Heading to bed? Check if your switches are safely turned off to save electricity!',
          data: { type: 'night_check' },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: 22,
          minute: 0,
          repeats: true,
        },
      });
    }

    // 2. Morning Routine Digest (8:00 AM)
    if (p.morningDigest) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '☀️ Good Morning from Lumo',
          body: 'Ready for the day? Tap here to control your home switches with ease.',
          data: { type: 'morning_routine' },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: 8,
          minute: 0,
          repeats: true,
        },
      });
    }

    console.log('[Notifications] Smart daily reminders scheduled successfully.');
  } catch (err) {
    console.warn('[Notifications] Failed to schedule smart reminders:', err);
  }
}

/**
 * Trigger an immediate local notification (e.g. Test notification, Timer finish, Night guard trip)
 */
export async function sendInstantNotification(
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
      },
      trigger: null, // null means trigger immediately
    });
  } catch (err) {
    console.warn('[Notifications] Error sending instant notification:', err);
  }
}

/**
 * Send Remote Push Notification to any device via Expo's official push server
 */
export async function sendPushNotificationToDevice(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<boolean> {
  if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) {
    console.warn('[Notifications] Invalid Expo push token:', expoPushToken);
    return false;
  }

  try {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data: data || { sender: 'Lumo Admin' },
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const resJson = await response.json();
    return resJson?.data?.status === 'ok';
  } catch (error) {
    console.error('[Notifications] Error sending push notification via Expo API:', error);
    return false;
  }
}

/**
 * Listen for notification response (when user taps on notification banner)
 */
export function addNotificationResponseListener(callback: (data: any) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    callback(data);
  });
}
