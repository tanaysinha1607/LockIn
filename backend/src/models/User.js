const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, GENDERS } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false, // Don't return password in query responses by default
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: Object.values(GENDERS),
      default: GENDERS.PREFER_NOT_TO_SAY,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    isOnboarded: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    fcmToken: {
      type: String,
      default: null,
    },
    // SHA-256 hashes of currently valid refresh tokens, one per signed-in device (newest last).
    refreshTokens: {
      type: [String],
      default: [],
      select: false,
    },
    notificationPreferences: {
      buddyRequests: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      checkInReminders: { type: Boolean, default: true },
      motivationalNudges: { type: Boolean, default: true },
      challengeUpdates: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
