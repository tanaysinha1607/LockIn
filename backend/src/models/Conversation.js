const mongoose = require('mongoose');
const { MESSAGE_TYPES } = require('../config/constants');

const conversationSchema = new mongoose.Schema(
  {
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
      unique: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      content: { type: String, default: '' },
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      timestamp: { type: Date },
      type: {
        type: String,
        enum: Object.values(MESSAGE_TYPES),
        default: MESSAGE_TYPES.TEXT,
      },
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
conversationSchema.index({ participants: 1, isActive: 1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
