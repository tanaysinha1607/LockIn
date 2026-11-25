const mongoose = require('mongoose');
const { DIET_TYPES } = require('../config/constants');

const dietPlanSchema = new mongoose.Schema(
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
    dietType: {
      type: String,
      enum: Object.values(DIET_TYPES),
      required: true,
    },
    dailyCalories: {
      type: Number,
      required: true,
    },
    macros: {
      protein: { type: Number, required: true }, // in grams
      carbs: { type: Number, required: true },
      fats: { type: Number, required: true },
    },
    meals: [
      {
        name: { type: String, required: true }, // Breakfast, Snack, Lunch, Dinner, etc.
        time: { type: String, default: null }, // e.g. "08:00"
        foods: [
          {
            item: { type: String, required: true },
            quantity: { type: String, required: true }, // e.g. "2 large eggs" or "100g oats"
            calories: { type: Number, default: 0 },
            protein: { type: Number, default: 0 },
          },
        ],
        totalCalories: { type: Number, default: 0 },
        totalProtein: { type: Number, default: 0 },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    generatedBy: {
      type: String,
      default: 'ai',
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
dietPlanSchema.index({ userId: 1, isActive: 1 });
dietPlanSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

const DietPlan = mongoose.model('DietPlan', dietPlanSchema);

module.exports = DietPlan;
