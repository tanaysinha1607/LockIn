const mongoose = require('mongoose');
const { PARTICIPATION_STATUS } = require('../config/constants');

const challengeParticipationSchema = new mongoose.Schema(
  {
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Challenge',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    progress: {
      type: Number,
      default: 0,
    },
    target: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PARTICIPATION_STATUS),
      default: PARTICIPATION_STATUS.IN_PROGRESS,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    xpEarned: {
      type: Number,
      default: 0,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
challengeParticipationSchema.index({ userId: 1, status: 1 });
challengeParticipationSchema.index({ challengeId: 1, progress: -1 });
challengeParticipationSchema.index({ challengeId: 1, userId: 1 }, { unique: true });

const ChallengeParticipation = mongoose.model('ChallengeParticipation', challengeParticipationSchema);

module.exports = ChallengeParticipation;
