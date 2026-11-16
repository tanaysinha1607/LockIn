const mongoose = require('mongoose');
const { 
  FITNESS_LEVELS, 
  COMMITMENT_TYPES,
  FITNESS_GOALS, 
  WORKOUT_TYPES, 
  DIET_TYPES, 
  BUDDY_GENDER_PREFS, 
  BUDDY_LEVEL_RANGES,
  SLEEP_PATTERNS
} = require('../config/constants');

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    bio: {
      type: String,
      maxlength: 300,
      default: '',
    },
    fitnessLevel: {
      type: String,
      enum: Object.values(FITNESS_LEVELS),
      required: true,
    },
    commitmentType: {
      type: String,
      enum: Object.values(COMMITMENT_TYPES),
      default: COMMITMENT_TYPES.REGULAR,
      required: true,
    },
    fitnessGoals: {
      type: [String],
      enum: Object.values(FITNESS_GOALS),
      required: true,
    },
    workoutTypes: {
      type: [String],
      enum: Object.values(WORKOUT_TYPES),
      required: true,
    },
    preferredWorkoutDays: {
      type: [String],
      required: true,
    },
    preferredWorkoutTime: {
      start: {
        type: String, // "HH:mm" format, e.g. "06:00"
        required: true,
      },
      end: {
        type: String, // "HH:mm" format, e.g. "08:00"
        required: true,
      },
    },
    workoutDuration: {
      type: Number,
      default: 60, // in minutes
    },
    gymLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    gymName: {
      type: String,
      default: '',
    },
    gymAddress: {
      type: String,
      default: '',
    },
    height: {
      type: Number, // in cm
      default: null,
    },
    weight: {
      type: Number, // in kg
      default: null,
    },
    dietType: {
      type: String,
      enum: Object.values(DIET_TYPES),
      default: DIET_TYPES.FLEXIBLE,
    },
    sleepPattern: {
      type: String,
      enum: Object.values(SLEEP_PATTERNS),
      default: SLEEP_PATTERNS.NORMAL,
    },
    injuries: {
      type: [String],
      default: [],
    },
    equipment: {
      type: [String],
      default: [],
    },
    experienceYears: {
      type: Number,
      default: 0,
    },
    buddyPreferences: {
      genderPreference: {
        type: String,
        enum: Object.values(BUDDY_GENDER_PREFS),
        default: BUDDY_GENDER_PREFS.ANY,
      },
      levelRange: {
        type: String,
        enum: Object.values(BUDDY_LEVEL_RANGES),
        default: BUDDY_LEVEL_RANGES.ANY,
      },
      maxDistance: {
        type: Number, // in km
        default: 10,
      },
      ageRange: {
        min: { type: Number, default: 18 },
        max: { type: Number, default: 50 },
      },
    },
    consistencyScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    xp: {
      type: Number,
      default: 0,
    },
    level: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Enable 2dsphere index for geographic matching queries
profileSchema.index({ gymLocation: '2dsphere' });

const Profile = mongoose.model('Profile', profileSchema);

module.exports = Profile;
