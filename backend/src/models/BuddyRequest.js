const mongoose = require('mongoose');
const { BUDDY_REQUEST_STATUS } = require('../config/constants');

const buddyRequestSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(BUDDY_REQUEST_STATUS),
      default: BUDDY_REQUEST_STATUS.PENDING,
    },
    compatibilityScore: {
      type: Number,
      default: null,
    },
    message: {
      type: String,
      default: '',
      maxlength: 200,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
buddyRequestSchema.index({ receiverId: 1, status: 1 });
buddyRequestSchema.index({ senderId: 1, status: 1 });
buddyRequestSchema.index({ senderId: 1, receiverId: 1, status: 1 });

const BuddyRequest = mongoose.model('BuddyRequest', buddyRequestSchema);

module.exports = BuddyRequest;
