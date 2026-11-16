const mongoose = require('mongoose');
const { SESSION_STATUS } = require('../config/constants');

const sessionSchema = new mongoose.Schema(
  {
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    scheduledDate: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number, // planned duration in minutes
      default: 60,
    },
    workoutType: {
      type: String,
      default: null,
    },
    location: {
      type: String, // Gym name or address
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(SESSION_STATUS),
      default: SESSION_STATUS.PENDING,
    },
    confirmedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
sessionSchema.index({ participants: 1, scheduledDate: 1, status: 1 });
sessionSchema.index({ matchId: 1, scheduledDate: -1 });

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
