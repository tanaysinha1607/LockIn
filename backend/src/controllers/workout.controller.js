const workoutService = require('../services/workout.service');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');
const { todayUTC } = require('../utils/date');

/** POST /api/v1/workouts  - log (or replace) a day's workout; date defaults to today */
const save = asyncHandler(async (req, res) => {
  const workout = await workoutService.saveWorkout(req.user._id, req.body);
  res.status(200).json(ApiResponse.success('Workout saved', { workout }));
});

/** GET /api/v1/workouts?before=YYYY-MM-DD&limit=20 */
const list = asyncHandler(async (req, res) => {
  const workouts = await workoutService.listWorkouts(req.user._id, req.query);
  res.status(200).json(ApiResponse.success('Workouts retrieved', { workouts }));
});

/** GET /api/v1/workouts/today */
const today = asyncHandler(async (req, res) => {
  const workout = await workoutService.getWorkout(req.user._id, todayUTC());
  res.status(200).json(ApiResponse.success("Today's workout", { workout }));
});

/** GET /api/v1/workouts/exercises */
const exercises = asyncHandler(async (req, res) => {
  const list = await workoutService.listExercises(req.user._id);
  res.status(200).json(ApiResponse.success('Exercises retrieved', { exercises: list }));
});

/** GET /api/v1/workouts/progress?exercise=Bench%20Press */
const progress = asyncHandler(async (req, res) => {
  const points = await workoutService.exerciseProgress(req.user._id, req.query.exercise, req.query.limit);
  res.status(200).json(ApiResponse.success('Progress retrieved', { exercise: req.query.exercise, points }));
});

/** DELETE /api/v1/workouts/:date */
const remove = asyncHandler(async (req, res) => {
  await workoutService.deleteWorkout(req.user._id, req.params.date);
  res.status(200).json(ApiResponse.success('Workout deleted'));
});

module.exports = { save, list, today, exercises, progress, remove };
