const mongoose = require('mongoose');

const setSchema = new mongoose.Schema(
  {
    reps: { type: Number, required: true, min: 1, max: 500 },
    weight: { type: Number, default: 0, min: 0, max: 1000 }, // kg; 0 = bodyweight
  },
  { _id: false }
);

const exerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // Lowercased name, used to group the same exercise across days for progress charts
    key: { type: String, required: true },
    sets: { type: [setSchema], default: [] },
  },
  { _id: false }
);

/**
 * One workout log per user per day (UTC date, same as CheckIn.date).
 */
const workoutLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD (UTC)
    workoutType: { type: String, default: null },
    durationMin: { type: Number, default: null, min: 1, max: 600 },
    notes: { type: String, default: '', maxlength: 500 },
    exercises: { type: [exerciseSchema], default: [] },
    totalSets: { type: Number, default: 0 },
    totalVolume: { type: Number, default: 0 }, // sum of reps x kg
  },
  { timestamps: true }
);

workoutLogSchema.index({ userId: 1, date: -1 }, { unique: true });
workoutLogSchema.index({ userId: 1, 'exercises.key': 1, date: -1 });

workoutLogSchema.pre('validate', function computeTotals(next) {
  let sets = 0;
  let volume = 0;
  (this.exercises || []).forEach((ex) => {
    ex.key = String(ex.name || '').trim().toLowerCase();
    (ex.sets || []).forEach((s) => {
      sets += 1;
      volume += (s.reps || 0) * (s.weight || 0);
    });
  });
  this.totalSets = sets;
  this.totalVolume = Math.round(volume);
  next();
});

module.exports = mongoose.model('WorkoutLog', workoutLogSchema);
