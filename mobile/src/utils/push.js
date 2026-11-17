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

/**
 * Asks for permission, gets this device's Expo push token and registers it with the server.
 * Safe to call on every app start; quietly does nothing on web, simulators, or when push
 * isn't available (e.g. Expo Go on Android, or no EAS projectId configured).
 * @returns {Promise<string|null>} the token, or null
 */
export const registerForPushNotifications = async () => {
  if (!supported || !Device.isDevice) return null;

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
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('Push disabled: no EAS projectId. Run `npx eas init` in mobile/ to enable push.');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const result = await notificationApi.registerPushToken(token);
    if (result.success) await AsyncStorage.setItem(STORED_TOKEN_KEY, token);
    return token;
  } catch (err) {
    console.warn('Push registration skipped:', err?.message || err);
    return null;
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
