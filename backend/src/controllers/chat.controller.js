const chatService = require('../services/chat.service');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');
const { getIO } = require('../socket');
const { logger } = require('../utils/logger');

/**
 * Get all conversations for logged in user
 * GET /api/v1/chat/conversations
 */
const getConversations = asyncHandler(async (req, res) => {
  const conversations = await chatService.getUserConversations(req.user._id);

  res.status(200).json(
    ApiResponse.success('Conversations retrieved successfully', conversations)
  );
});

/**
 * Get message history for a conversation (paginated)
 * GET /api/v1/chat/conversations/:conversationId/messages
 */
const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { before, limit } = req.query;

  const messages = await chatService.getMessages(req.user._id, conversationId, {
    before,
    limit,
  });

  res.status(200).json(
    ApiResponse.success('Messages retrieved successfully', messages)
  );
});

/**
 * Send a message via REST endpoint
 * POST /api/v1/chat/conversations/:conversationId/messages
 */
const sendMessage = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { content, type } = req.body;

  const message = await chatService.sendMessage(req.user._id, conversationId, content, type);

  // Emit to socket room so real-time client receives it
  try {
    const io = getIO();
    io.to(`conv:${conversationId}`).emit('chat:message', message);
  } catch (err) {
    logger.error('Failed to emit message to socket room:', err);
  }

  res.status(201).json(
    ApiResponse.success('Message sent successfully', message)
  );
});

/**
 * Mark all messages in a conversation as read
 * PUT /api/v1/chat/conversations/:conversationId/read
 */
const markAsRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  await chatService.markAsRead(req.user._id, conversationId);

  // Notify other user in socket room that messages are read
  try {
    const io = getIO();
    io.to(`conv:${conversationId}`).emit('chat:read', {
      conversationId,
      userId: req.user._id,
    });
  } catch (err) {
    logger.error('Failed to emit read receipt to socket room:', err);
  }

  res.status(200).json(
    ApiResponse.success('Conversation marked as read')
  );
});

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
};
