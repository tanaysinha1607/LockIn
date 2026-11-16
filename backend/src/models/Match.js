const mongoose = require('mongoose');
const { MATCH_STATUS, MATCH_END_REASONS } = require('../config/constants');

const matchSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    compatibilityScore: {
      type: Number,
      required: true,
    },
    scoreBreakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: Object.values(MATCH_STATUS),
      default: MATCH_STATUS.ACTIVE,
    },
    lockInCount: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    endReason: {
      type: String,
      enum: [...Object.values(MATCH_END_REASONS), null],
      default: null,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
matchSchema.index({ users: 1, status: 1 });
matchSchema.index({ lockInCount: -1 });

const Match = mongoose.model('Match', matchSchema);

module.exports = Match;
