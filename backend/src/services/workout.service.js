const { WorkoutLog } = require('../models');
const AppError = require('../utils/AppError');
const { todayUTC, diffDaysUTC } = require('../utils/date');

const MAX_BACKDATE_DAYS = 7;

/**
 * Create or replace the workout log for one day (default today).
 */
const saveWorkout = async (userId, { date, workoutType, durationMin, notes, exercises }) => {
  const today = todayUTC();
  const day = date || today;
  const age = diffDaysUTC(day, today);
  if (age < 0) throw new AppError("You can't log a workout for a future day.", 400);
  if (age > MAX_BACKDATE_DAYS) throw new AppError(`You can only log workouts from the last ${MAX_BACKDATE_DAYS} days.`, 400);

  const cleaned = (exercises || [])
    .map((ex) => ({ name: String(ex.name || '').trim(), sets: (ex.sets || []).filter((s) => s.reps > 0) }))
    .filter((ex) => ex.name && ex.sets.length);
  if (!cleaned.length) throw new AppError('Add at least one exercise with a set.', 400);

  let log = await WorkoutLog.findOne({ userId, date: day });
  if (!log) log = new WorkoutLog({ userId, date: day });
  log.set({
    workoutType: workoutType || null,
    durationMin: durationMin || null,
    notes: notes || '',
    exercises: cleaned,
  });
  await log.save();
  return log;
};

const getWorkout = (userId, date) => WorkoutLog.findOne({ userId, date });

const listWorkouts = (userId, { before, limit = 20 } = {}) => {
  const query = { userId };
  if (before) query.date = { $lt: before };
  return WorkoutLog.find(query).sort({ date: -1 }).limit(Number(limit));
};

const deleteWorkout = async (userId, date) => {
  const res = await WorkoutLog.deleteOne({ userId, date });
  if (!res.deletedCount) throw new AppError('No workout logged for that day.', 404);
};

/**
 * Every exercise the user has logged, most recent first, with their best set.
 */
const listExercises = (userId) =>
  WorkoutLog.aggregate([
    { $match: { userId } },
    { $unwind: '$exercises' },
    { $unwind: '$exercises.sets' },
    {
      $group: {
        _id: '$exercises.key',
        name: { $last: '$exercises.name' },
        lastDate: { $max: '$date' },
        bestWeight: { $max: '$exercises.sets.weight' },
        sessions: { $addToSet: '$date' },
      },
    },
    { $project: { _id: 0, key: '$_id', name: 1, lastDate: 1, bestWeight: 1, sessions: { $size: '$sessions' } } },
    { $sort: { lastDate: -1, sessions: -1 } },
    { $limit: 100 },
  ]);

/**
 * Per-session progress for one exercise (oldest -> newest): top weight, volume, best set.
 */
const exerciseProgress = async (userId, exerciseName, limit = 20) => {
  const key = String(exerciseName || '').trim().toLowerCase();
  const logs = await WorkoutLog.find({ userId, 'exercises.key': key })
    .sort({ date: -1 })
    .limit(Number(limit))
    .lean();

  return logs
    .map((log) => {
      const sets = log.exercises.filter((e) => e.key === key).flatMap((e) => e.sets);
      const maxWeight = Math.max(0, ...sets.map((s) => s.weight || 0));
      const volume = sets.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0);
      const best = sets.reduce((b, s) => (!b || s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps) ? s : b), null);
      // Estimated 1-rep max (Epley), the usual single number for strength progress
      const e1rm = best && best.weight ? Math.round(best.weight * (1 + best.reps / 30)) : 0;
      return { date: log.date, maxWeight, volume: Math.round(volume), sets: sets.length, bestSet: best, e1rm };
    })
    .reverse();
};

/**
 * Short plain-text summary of recent training, for the AI coach prompts.
 */
const trainingSummary = async (userId, days = 5) => {
  const logs = await WorkoutLog.find({ userId }).sort({ date: -1 }).limit(days).lean();
  if (!logs.length) return 'No workouts logged yet.';
  return logs
    .map((log) => {
      const parts = log.exercises.map((ex) => {
        const top = ex.sets.reduce((b, s) => (!b || s.weight > b.weight ? s : b), null);
        return `${ex.name} ${ex.sets.length}x${top ? `${top.reps}${top.weight ? `@${top.weight}kg` : ''}` : ''}`;
      });
      return `${log.date}${log.workoutType ? ` (${log.workoutType})` : ''}: ${parts.join(', ')}`;
    })
    .join('\n');
};

module.exports = {
  saveWorkout,
  getWorkout,
  listWorkouts,
  deleteWorkout,
  listExercises,
  exerciseProgress,
  trainingSummary,
  MAX_BACKDATE_DAYS,
};
