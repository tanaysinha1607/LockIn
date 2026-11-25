import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { notificationApi } from './api';

const STORED_TOKEN_KEY = 'expo_push_token';
const supported = Platform.OS !== 'web';

if (supported) {
  // Show pushes as banners even while the app is open
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// Result of the last registration attempt, shown on the Notifications screen in development
let lastStatus = { status: 'not-tried', message: 'Push registration has not run yet.' };
export const getPushStatus = () => lastStatus;

const finish = (status, message, token = null) => {
  lastStatus = { status, message, token };
  console.log(`[push] ${status}: ${message}`);
  return token;
};

/**
 * Asks for permission, gets this device's Expo push token and registers it with the server.
 * Safe to call on every app start. On web, simulators, Expo Go on Android, or without an
 * EAS projectId it does nothing and records why (see getPushStatus()).
 * @returns {Promise<string|null>} the token, or null
 */
export const registerForPushNotifications = async () => {
  if (!supported) return finish('unsupported', 'Push notifications are not available on web.');
  if (!Device.isDevice) return finish('unsupported', 'Push needs a real phone, not a simulator.');

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'LockIn',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') {
      return finish(
        'denied',
        'Notification permission is off. Turn it on in iPhone Settings → Expo Go → Notifications.'
      );
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      return finish('no-project', 'No EAS projectId in app.json. Run `eas init` in mobile/.');
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    // Timezone lets the server send reminders at your local workout time
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const result = await notificationApi.registerPushToken(token, timezone);
    if (!result.success) {
      return finish('error', `Got a token but the server rejected it: ${result.message}`);
    }
    await AsyncStorage.setItem(STORED_TOKEN_KEY, token);
    return finish('registered', 'This phone is registered for push.', token);
  } catch (err) {
    return finish('error', `Could not get a push token: ${err?.message || err}`);
  }
};

/**
 * Removes this device's token from the server (call before logging out).
 */
export const unregisterPushNotifications = async () => {
  try {
    const token = await AsyncStorage.getItem(STORED_TOKEN_KEY);
    if (!token) return;
    await notificationApi.removePushToken(token);
    await AsyncStorage.removeItem(STORED_TOKEN_KEY);
  } catch {
    // best effort
  }
};

/**
 * Calls onOpen({ type, ...data }) when the user taps a push (including the one that
 * launched the app). Returns an unsubscribe function.
 */
export const listenForPushTaps = (onOpen) => {
  if (!supported) return () => {};

  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data) onOpen(data);
    })
    .catch(() => {});

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data;
    if (data) onOpen(data);
  });
  return () => sub.remove();
};
