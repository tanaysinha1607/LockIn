const socketIo = require('socket.io');
const socketAuth = require('./auth');
const chatService = require('../services/chat.service');
const Conversation = require('../models/Conversation');
const { logger } = require('../utils/logger');

let io = null;

// Track online users: Map<userId, Set<socketId>>
const onlineUsers = new Map();

// Track message rate limiting: Map<userId, messageTimestampArray>
const rateLimiter = new Map();

/**
 * Initialize Socket.io on the HTTP server
 */
const initializeSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
    pingTimeout: 60000,
  });

  // Attach auth middleware
  io.use(socketAuth);

  io.on('connection', async (socket) => {
    const userId = String(socket.user._id);
    logger.info(`User connected to Socket.io: ${userId} (${socket.user.firstName})`);

    // 1. Add to online users
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Personal room: lets the server reach every device of this user (e.g. to join a
    // conversation created after they connected).
    socket.join(`user:${userId}`);

    // 2. Automatically join all conversation rooms the user is part of
    try {
      const conversations = await Conversation.find({
        participants: socket.user._id,
        isActive: true,
      });

      conversations.forEach((conv) => {
        const roomName = `conv:${conv._id}`;
        socket.join(roomName);
        logger.debug(`Socket ${socket.id} joined room: ${roomName}`);
      });
    } catch (err) {
      logger.error(`Error joining conversation rooms for user ${userId}:`, err);
    }

    // 3. Broadcast presence status to all matches
    broadcastPresence(userId, 'online');

    // 4. Handle check presence request
    socket.on('presence:check', (targetUserId, callback) => {
      const isOnline = onlineUsers.has(String(targetUserId));
      if (typeof callback === 'function') {
        callback({ status: isOnline ? 'online' : 'offline' });
      }
    });

    // 5. Handle typing indicators
    // Only relay typing events for conversations this socket actually belongs to
    const inConversation = (conversationId) => socket.rooms.has(`conv:${conversationId}`);

    socket.on('chat:typing', ({ conversationId } = {}) => {
      if (!inConversation(conversationId)) return;
      socket.to(`conv:${conversationId}`).emit('chat:typing', {
        conversationId,
        userId,
      });
    });

    socket.on('chat:stop_typing', ({ conversationId } = {}) => {
      if (!inConversation(conversationId)) return;
      socket.to(`conv:${conversationId}`).emit('chat:stop_typing', {
        conversationId,
        userId,
      });
    });

    // 6. Handle sending message via WebSocket
    socket.on('chat:send', async ({ conversationId, content, type } = {}, callback) => {
      try {
        // Simple socket rate limit check: max 30 messages per minute
        if (isRateLimited(userId)) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Too many messages. Please slow down.' });
          }
          return;
        }

        if (typeof content !== 'string' || !content.trim() || content.length > 2000) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Message must be 1-2000 characters.' });
          }
          return;
        }

        // Save message to DB using chat service (also verifies membership)
        const message = await chatService.sendMessage(socket.user._id, conversationId, content.trim(), type);

        // Broadcast message to room (including sender to confirm receipt across tabs/devices)
        io.to(`conv:${conversationId}`).emit('chat:message', message);

        // Notify callback if exists
        if (typeof callback === 'function') {
          callback({ success: true, message });
        }
      } catch (error) {
        logger.error(`Failed to handle chat:send for user ${userId}:`, error);
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message || 'Failed to send message' });
        }
      }
    });

    // 7. Handle read receipts
    socket.on('chat:read', async ({ conversationId } = {}) => {
      try {
        await chatService.markAsRead(socket.user._id, conversationId);
        // Notify other user in room that messages are read
        socket.to(`conv:${conversationId}`).emit('chat:read', {
          conversationId,
          userId,
        });
      } catch (error) {
        logger.error(`Error marking conversation ${conversationId} as read via socket:`, error);
      }
    });

    // 8. Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id} (user: ${userId})`);
      
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcast offline status if no active connections left
          broadcastPresence(userId, 'offline');
          rateLimiter.delete(userId);
        }
      }
    });
  });

  return io;
};

/**
 * Get Socket.io server instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized');
  }
  return io;
};

/**
 * Broadcast online/offline presence updates to user's conversation rooms
 */
const broadcastPresence = async (userId, status) => {
  try {
    const conversations = await Conversation.find({
      participants: userId,
      isActive: true,
    });

    conversations.forEach((conv) => {
      io.to(`conv:${conv._id}`).emit('presence:update', {
        userId,
        status,
      });
    });
  } catch (err) {
    logger.error(`Error broadcasting presence for user ${userId}:`, err);
  }
};

/**
 * Simple in-memory sliding window rate limiter
 */
const isRateLimited = (userId) => {
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const limit = 30; // max 30 messages/min

  if (!rateLimiter.has(userId)) {
    rateLimiter.set(userId, []);
  }

  const timestamps = rateLimiter.get(userId);
  
  // Filter out timestamps outside the window
  const validTimestamps = timestamps.filter((ts) => now - ts < windowMs);
  
  if (validTimestamps.length >= limit) {
    return true;
  }

  validTimestamps.push(now);
  rateLimiter.set(userId, validTimestamps);
  return false;
};

/**
 * Add every connected socket of the given users to a conversation room.
 * Call after creating a conversation so both buddies get live messages without reconnecting.
 */
const joinUsersToConversation = (userIds, conversationId) => {
  if (!io) return;
  userIds.forEach((id) => {
    io.in(`user:${id}`).socketsJoin(`conv:${conversationId}`);
  });
};

module.exports = {
  initializeSocket,
  getIO,
  joinUsersToConversation,
};
