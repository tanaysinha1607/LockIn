const mongoose = require('mongoose');
const { FITNESS_LEVELS, FITNESS_GOALS } = require('../config/constants');

const workoutPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    duration: {
      type: Number, // in weeks
      required: true,
    },
    fitnessLevel: {
      type: String,
      enum: Object.values(FITNESS_LEVELS),
      required: true,
    },
    goals: {
      type: [String],
      enum: Object.values(FITNESS_GOALS),
      required: true,
    },
    schedule: [
      {
        day: { type: String, required: true },
        isRestDay: { type: Boolean, default: false },
        focus: { type: String, default: '' },
        exercises: [
          {
            name: { type: String, required: true },
            sets: { type: Number, required: true },
            reps: { type: String, required: true }, // "12" or "30s"
            restSeconds: { type: Number, default: 60 },
            notes: { type: String, default: '' },
          },
        ],
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    generatedBy: {
      type: String,
      default: 'gpt-4o',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
workoutPlanSchema.index({ userId: 1, isActive: 1 });
workoutPlanSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

const WorkoutPlan = mongoose.model('WorkoutPlan', workoutPlanSchema);

module.exports = WorkoutPlan;
