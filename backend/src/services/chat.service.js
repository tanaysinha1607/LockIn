const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Match = require('../models/Match');
const AppError = require('../utils/AppError');
const { MESSAGE_TYPES } = require('../config/constants');

/**
 * Fetch all conversations for a user
 * Populates participant details (other user) and last message
 */
const getUserConversations = async (userId) => {
  const conversations = await Conversation.find({
    participants: userId,
    isActive: true,
  })
    .populate('participants', 'firstName lastName avatar lastActive gender')
    .sort({ 'lastMessage.timestamp': -1, updatedAt: -1 });

  // Format to return clean response containing buddy user object
  return conversations.map((conv) => {
    const buddy = conv.participants.find((p) => String(p._id) !== String(userId));
    
    // Convert Mongoose map to plain object
    const unreadCountObj = conv.unreadCount ? Object.fromEntries(conv.unreadCount) : {};
    const unread = unreadCountObj[String(userId)] || 0;

    return {
      _id: conv._id,
      matchId: conv.matchId,
      buddy: buddy || null,
      lastMessage: conv.lastMessage,
      unreadCount: unread,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    };
  });
};

/**
 * Fetch messages for a conversation (paginated using "before" cursor timestamp)
 */
const getMessages = async (userId, conversationId, { before, limit = 50 } = {}) => {
  // Verify user is participant
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });

  if (!conversation) {
    throw new AppError('Conversation not found or access denied.', 403);
  }

  // Construct query
  const query = { conversationId };
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit, 10))
    .populate('senderId', 'firstName lastName avatar');

  return messages;
};

/**
 * Phone push for participants who don't have the app open. No in-app notification row:
 * the chat list already shows unread counts.
 */
const pushToOfflineParticipants = async (conversation, senderId, message, content) => {
  const { notify } = require('./notification.service');
  const { NOTIFICATION_TYPES } = require('../config/constants');
  let isUserOnline = () => false;
  try {
    ({ isUserOnline } = require('../socket'));
  } catch {
    // socket layer unavailable
  }

  const senderName = message.senderId?.firstName || 'Your buddy';
  const preview = content.length > 120 ? `${content.slice(0, 117)}...` : content;

  const recipients = conversation.participants.filter(
    (p) => String(p) !== String(senderId) && !isUserOnline(p)
  );
  await Promise.all(
    recipients.map((recipientId) =>
      notify(
        {
          userId: recipientId,
          type: NOTIFICATION_TYPES.MESSAGE,
          title: senderName,
          body: preview,
          data: {
            conversationId: conversation._id,
            buddyId: senderId,
            buddyName: senderName,
          },
        },
        { store: false }
      )
    )
  );
};

/**
 * Send a message within a conversation
 */
const sendMessage = async (userId, conversationId, content, type = MESSAGE_TYPES.TEXT) => {
  // Find conversation and verify user is participant
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });

  if (!conversation) {
    throw new AppError('Conversation not found or access denied.', 403);
  }

  // Verify match is still active
  const match = await Match.findOne({
    _id: conversation.matchId,
    status: 'active',
  });

  if (!match) {
    throw new AppError('Cannot send message. The gym buddy match is no longer active.', 400);
  }

  // Create message
  let message = await Message.create({
    conversationId,
    senderId: userId,
    content,
    type,
    readBy: [userId], // Sender has already read it
  });

  // Populate sender info
  message = await message.populate('senderId', 'firstName lastName avatar');

  // Update Conversation's lastMessage
  conversation.lastMessage = {
    content,
    senderId: userId,
    timestamp: message.createdAt,
    type,
  };

  // Increment unreadCount for other participants
  conversation.participants.forEach((participantId) => {
    if (String(participantId) !== String(userId)) {
      const currentVal = conversation.unreadCount.get(String(participantId)) || 0;
      conversation.unreadCount.set(String(participantId), currentVal + 1);
    }
  });

  await conversation.save();

  pushToOfflineParticipants(conversation, userId, message, content).catch(() => {});

  return message;
};

/**
 * Mark all messages in a conversation as read for the user
 */
const markAsRead = async (userId, conversationId) => {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });

  if (!conversation) {
    throw new AppError('Conversation not found or access denied.', 403);
  }

  // Add user to readBy array for any message they haven't read
  await Message.updateMany(
    {
      conversationId,
      senderId: { $ne: userId },
      readBy: { $ne: userId },
    },
    {
      $addToSet: { readBy: userId },
    }
  );

  // Reset unread count for this user
  conversation.unreadCount.set(String(userId), 0);
  await conversation.save();

  return conversation;
};

module.exports = {
  getUserConversations,
  getMessages,
  sendMessage,
  markAsRead,
};
