const mongoose = require('mongoose');
const { MOODS } = require('../config/constants');

const checkInSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // format: YYYY-MM-DD
      required: true,
    },
    checkInTime: {
      type: Date,
      default: Date.now,
      required: true,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number, // in minutes
      default: null,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    lockInMatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      default: null,
    },
    isLockIn: {
      type: Boolean,
      default: false,
    },
    xpEarned: {
      type: Number,
      default: 10,
    },
    workoutType: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
    mood: {
      type: String,
      enum: [...MOODS, null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
checkInSchema.index({ userId: 1, date: 1 }, { unique: true });
checkInSchema.index({ userId: 1, date: -1 });
checkInSchema.index({ date: 1, userId: 1, isLockIn: 1 });
checkInSchema.index({ location: '2dsphere' }, { sparse: true });

const CheckIn = mongoose.model('CheckIn', checkInSchema);

module.exports = CheckIn;
