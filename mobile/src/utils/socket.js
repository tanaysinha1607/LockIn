import { io } from 'socket.io-client';
import { getBaseUrl, getAccessToken, refreshAccessToken } from './api';

let socket = null;
const listeners = new Map();

/**
 * Connect to the Socket.io server
 * @param {string} token - JWT access token
 */
export const connectSocket = (token) => {
  if (socket) {
    if (socket.connected) return socket;
    socket.connect();
    return socket;
  }

  // Get raw base url (e.g. http://127.0.0.1:5000/api/v1 -> http://127.0.0.1:5000)
  const apiUrl = getBaseUrl();
  const socketUrl = apiUrl.replace('/api/v1', '');

  console.log(`Connecting Socket.io client to: ${socketUrl}`);

  socket = io(socketUrl, {
    // Evaluated on every (re)connect so a reconnect after the 15-minute access token
    // expires uses the latest token instead of the one from app start.
    auth: (cb) => cb({ token: getAccessToken() || token }),
    transports: ['websocket'], // Force WebSocket transport for better stability in RN
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Socket.io connected successfully');
    
    // Re-register any pending listeners
    listeners.forEach((callbacks, event) => {
      callbacks.forEach((cb) => socket.on(event, cb));
    });
  });

  let refreshingForSocket = false;
  socket.on('connect_error', async (err) => {
    console.warn('Socket.io connection error:', err.message);

    // Expired access token: refresh once, then retry the handshake with the new token
    if (err.message?.startsWith('Authentication error') && !refreshingForSocket) {
      refreshingForSocket = true;
      const newToken = await refreshAccessToken();
      refreshingForSocket = false;
      if (newToken && socket && !socket.connected) socket.connect();
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`Socket.io disconnected: ${reason}`);
  });

  return socket;
};

/**
 * Disconnect from the Socket.io server
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    listeners.clear();
    console.log('Socket.io client disconnected and cleaned up');
  }
};

/**
 * Get the current socket instance
 */
export const getSocket = () => socket;

/**
 * Register a listener for socket events
 * Tracks listeners so they can be re-bound on reconnect
 */
export const registerSocketListener = (event, callback) => {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);

  if (socket) {
    socket.on(event, callback);
  }

  // Return unregister helper
  return () => {
    const eventListeners = listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) {
        listeners.delete(event);
      }
    }
    if (socket) {
      socket.off(event, callback);
    }
  };
};

/**
 * Emit an event to the server
 */
export const emitSocketEvent = (event, data, callback) => {
  if (!socket || !socket.connected) {
    console.warn(`Cannot emit event "${event}": Socket not connected`);
    if (typeof callback === 'function') {
      callback({ success: false, error: 'Socket not connected' });
    }
    return;
  }
  socket.emit(event, data, callback);
};
