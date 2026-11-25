const mongoose = require('mongoose');
const { ACTIVITY_LOG_ACTIONS } = require('../config/constants');

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: Object.values(ACTIVITY_LOG_ACTIONS),
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    xpChange: {
      type: Number,
      default: 0,
    },
    // Buddy feed reactions: one emoji per reacting user
    reactions: {
      type: [
        {
          _id: false,
          userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
          emoji: { type: String, required: true },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

// TTL index to automatically archive/delete activity logs after 180 days
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;
