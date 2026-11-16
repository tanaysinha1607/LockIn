const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    icon: {
      type: String, // Emoji or icon code/URL
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
      required: true,
    },
    criteria: {
      type: { type: String, required: true }, // e.g. "current_streak" or "lock_in_count"
      threshold: { type: Number, required: true }, // value to reach
    },
    xpReward: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Badge = mongoose.model('Badge', badgeSchema);

module.exports = Badge;
