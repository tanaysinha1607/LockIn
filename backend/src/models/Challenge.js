const mongoose = require('mongoose');
const { CHALLENGE_TYPES, CHALLENGE_CATEGORIES, CHALLENGE_STATUS } = require('../config/constants');

const challengeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(CHALLENGE_TYPES),
      required: true,
    },
    category: {
      type: String,
      enum: Object.values(CHALLENGE_CATEGORIES),
      default: CHALLENGE_CATEGORIES.GENERAL,
    },
    target: {
      type: Number, // Target count (e.g. 7 for 7-day streak)
      required: true,
    },
    duration: {
      type: Number, // in days
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CHALLENGE_STATUS),
      default: CHALLENGE_STATUS.UPCOMING,
    },
    rewards: {
      xp: { type: Number, required: true, default: 0 },
      badgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge', default: null },
      streakFreeze: { type: Number, default: 0 },
    },
    maxParticipants: {
      type: Number,
      default: null, // null means unlimited
    },
    participantCount: {
      type: Number,
      default: 0,
    },
    coverImage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
challengeSchema.index({ status: 1, startDate: -1 });
challengeSchema.index({ type: 1, status: 1 });
challengeSchema.index({ startDate: 1, status: 1 });

const Challenge = mongoose.model('Challenge', challengeSchema);

module.exports = Challenge;
