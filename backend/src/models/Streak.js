const mongoose = require('mongoose');

const streakSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    currentStreak: {
      type: Number,
      default: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
    },
    lastCheckInDate: {
      type: String, // format YYYY-MM-DD
      default: null,
    },
    totalCheckIns: {
      type: Number,
      default: 0,
    },
    totalLockIns: {
      type: Number,
      default: 0,
    },
    streakHistory: [
      {
        startDate: { type: String, required: true },
        endDate: { type: String, required: true },
        length: { type: Number, required: true },
      },
    ],
    weeklyCheckIns: {
      type: Number,
      default: 0,
    },
    monthlyCheckIns: {
      type: Number,
      default: 0,
    },
    streakFreezes: {
      type: Number,
      default: 2, // Start with 2 free freezes
    },
  },
  {
    timestamps: true,
  }
);

const Streak = mongoose.model('Streak', streakSchema);

module.exports = Streak;
