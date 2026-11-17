import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { disconnectSocket } from './socket';
// push.js imports from this file too; that's fine because both only use each other inside functions
import { unregisterPushNotifications } from './push';

// Override via app.json expo.extra.apiUrl for physical devices (e.g. http://192.168.x.x:5000/api/v1)
const DEFAULT_BASE_URL = 'http://127.0.0.1:5000/api/v1';
const BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  DEFAULT_BASE_URL;

let accessToken = null;
let logoutCallback = null;

export const getBaseUrl = () => BASE_URL;

export const setLogoutCallback = (callback) => {
  logoutCallback = callback;
};

export const initializeAuthTokens = async () => {
  try {
    accessToken = await AsyncStorage.getItem('access_token');
    return accessToken;
  } catch (error) {
    console.error('Failed to load auth tokens:', error);
    return null;
  }
};

export const setAuthTokens = async (access, refresh) => {
  try {
    accessToken = access;
    await AsyncStorage.setItem('access_token', access);
    if (refresh) {
      await AsyncStorage.setItem('refresh_token', refresh);
    }
  } catch (error) {
    console.error('Failed to store auth tokens:', error);
  }
};

export const clearAuthTokens = async () => {
  try {
    accessToken = null;
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
  } catch (error) {
    console.error('Failed to clear auth tokens:', error);
  }
};

export const getAccessToken = () => accessToken;

// Single in-flight refresh shared by every caller. Refresh tokens are single-use on the
// server, so if two requests 401 at once and both refreshed, the second would present an
// already-rotated token, the server would treat it as theft, and the user would be logged out.
let refreshPromise = null;

const doRefresh = async () => {
  try {
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    if (!refreshToken) throw new Error('No refresh token available');

    const response = await fetch(`${BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const result = await response.json();
    if (result.success && result.data) {
      const { accessToken: newAccess, refreshToken: newRefresh } = result.data;
      await setAuthTokens(newAccess, newRefresh);
      return newAccess;
    }
    throw new Error('Refresh token rejected');
  } catch (error) {
    console.warn('Token refresh failed, logging out:', error);
    await clearAuthTokens();
    disconnectSocket();
    if (logoutCallback) logoutCallback();
    return null;
  }
};

export const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

const buildAuthHeaders = (token, extraHeaders = {}) => ({
  'Content-Type': 'application/json',
  ...extraHeaders,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export const apiCall = async (endpoint, options = {}) => {
  const url = `${BASE_URL}${endpoint}`;
  const tokenForRequest = accessToken;

  const makeRequest = (token) =>
    fetch(url, {
      ...options,
      headers: buildAuthHeaders(token, options.headers),
    });

  try {
    let response = await makeRequest(tokenForRequest);

    if (response.status === 401 && tokenForRequest) {
      // Another request may already have refreshed while this one was in flight
      const newAccessToken =
        accessToken && accessToken !== tokenForRequest ? accessToken : await refreshAccessToken();
      if (newAccessToken) {
        response = await makeRequest(newAccessToken);
      }
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'An error occurred',
        statusCode: response.status,
        code: data.code || null,
      };
    }

    return {
      success: true,
      data: data.data,
      message: data.message,
    };
  } catch (error) {
    console.error(`API Call failed on ${endpoint}:`, error);
    return {
      success: false,
      message: 'Network request failed. Please check your connection.',
      statusCode: 503,
    };
  }
};

export const authApi = {
  register: (userData) =>
    apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  login: (credentials) =>
    apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: async () => {
    // Stop pushes to this device for this account
    await unregisterPushNotifications();
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    const result = await apiCall('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    await clearAuthTokens();
    disconnectSocket();
    if (logoutCallback) logoutCallback();
    return result;
  },
};

export const userApi = {
  getMe: () =>
    apiCall('/users/me', {
      method: 'GET',
    }),

  updateProfile: (profileData) =>
    apiCall('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }),

  // { coordinates: [lng, lat], gymName?, gymAddress? } - limited to once per 7 days
  updateGymLocation: (payload) =>
    apiCall('/users/gym-location', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};

export const matchApi = {
  getSuggestions: () =>
    apiCall('/matches/suggestions', {
      method: 'GET',
    }),
};

export const buddyApi = {
  sendRequest: (receiverId) =>
    apiCall('/buddy-requests', {
      method: 'POST',
      body: JSON.stringify({ receiverId }),
    }),

  respondToRequest: (requestId, status) =>
    apiCall(`/buddy-requests/${requestId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  getIncoming: () =>
    apiCall('/buddy-requests/incoming', {
      method: 'GET',
    }),

  getOutgoing: () =>
    apiCall('/buddy-requests/outgoing', {
      method: 'GET',
    }),

  getActiveMatches: () =>
    apiCall('/buddy-requests/active', {
      method: 'GET',
    }),
};

export const checkInApi = {
  create: (payload = {}) =>
    apiCall('/check-ins', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const chatApi = {
  getConversations: () =>
    apiCall('/chat/conversations', {
      method: 'GET',
    }),

  getMessages: (conversationId, before = null) =>
    apiCall(`/chat/conversations/${conversationId}/messages${before ? `?before=${before}` : ''}`, {
      method: 'GET',
    }),

  sendMessage: (conversationId, content) =>
    apiCall(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  markAsRead: (conversationId) =>
    apiCall(`/chat/conversations/${conversationId}/read`, {
      method: 'PUT',
    }),
};

export const sessionApi = {
  create: (payload) =>
    apiCall('/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  list: () =>
    apiCall('/sessions', {
      method: 'GET',
    }),

  respond: (sessionId, status) =>
    apiCall(`/sessions/${sessionId}/respond`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  cancel: (sessionId) =>
    apiCall(`/sessions/${sessionId}/cancel`, {
      method: 'PUT',
    }),
};

export const challengeApi = {
  list: () =>
    apiCall('/challenges', {
      method: 'GET',
    }),

  listMy: () =>
    apiCall('/challenges/my', {
      method: 'GET',
    }),

  join: (challengeId) =>
    apiCall(`/challenges/${challengeId}/join`, {
      method: 'POST',
    }),

  getLeaderboard: (challengeId) =>
    apiCall(`/challenges/${challengeId}/leaderboard`, {
      method: 'GET',
    }),
};

export const badgeApi = {
  listAll: () =>
    apiCall('/badges', {
      method: 'GET',
    }),

  listMy: () =>
    apiCall('/badges/my', {
      method: 'GET',
    }),
};

export const leaderboardApi = {
  get: (filter = 'global', sortBy = 'xp') =>
    apiCall(`/leaderboard?filter=${filter}&sortBy=${sortBy}`, {
      method: 'GET',
    }),
};

export const aiApi = {
  getWorkoutPlan: (regenerate = false) =>
    apiCall(`/ai/workout-plan${regenerate ? '?regenerate=true' : ''}`, {
      method: 'GET',
    }),

  getDietPlan: (regenerate = false) =>
    apiCall(`/ai/diet-plan${regenerate ? '?regenerate=true' : ''}`, {
      method: 'GET',
    }),

  chat: (message, history = []) =>
    apiCall('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    }),
};


export const notificationApi = {
  list: (before = null, limit = 30) =>
    apiCall(`/notifications?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`, {
      method: 'GET',
    }),

  unreadCount: () =>
    apiCall('/notifications/unread-count', {
      method: 'GET',
    }),

  markRead: (notificationId) =>
    apiCall(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    }),

  markAllRead: () =>
    apiCall('/notifications/read-all', {
      method: 'PUT',
    }),

  registerPushToken: (token) =>
    apiCall('/notifications/push-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  removePushToken: (token) =>
    apiCall('/notifications/push-token', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    }),
};
