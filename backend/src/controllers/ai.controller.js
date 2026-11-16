const { Profile, WorkoutPlan, DietPlan } = require('../models');
const aiService = require('../services/ai.service');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

/**
 * GET /api/v1/ai/workout-plan
 * Retrieve active workout plan, or generate one if missing/expired/explicitly requested.
 */
const getWorkoutPlan = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const regenerate = req.query.regenerate === 'true';

  const profile = await Profile.findOne({ userId });
  if (!profile) {
    return next(new AppError('Profile not found. Please complete onboarding first.', 404));
  }

  let workoutPlan = await WorkoutPlan.findOne({ userId, isActive: true });

  const now = new Date();
  const isExpired = workoutPlan && now > workoutPlan.expiresAt;

  if (!workoutPlan || isExpired || regenerate) {
    // Deactivate previous plans if any
    await WorkoutPlan.updateMany({ userId, isActive: true }, { isActive: false });

    const newPlanData = await aiService.generateWorkoutPlan(userId, profile);
    workoutPlan = await WorkoutPlan.create(newPlanData);
  }

  res.status(200).json(
    ApiResponse.success('Workout plan retrieved successfully', { workoutPlan })
  );
});

/**
 * GET /api/v1/ai/diet-plan
 * Retrieve active diet plan, or generate one if missing/expired/explicitly requested.
 */
const getDietPlan = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const regenerate = req.query.regenerate === 'true';

  const profile = await Profile.findOne({ userId });
  if (!profile) {
    return next(new AppError('Profile not found. Please complete onboarding first.', 404));
  }

  let dietPlan = await DietPlan.findOne({ userId, isActive: true });

  const now = new Date();
  const isExpired = dietPlan && now > dietPlan.expiresAt;

  if (!dietPlan || isExpired || regenerate) {
    // Deactivate previous plans if any
    await DietPlan.updateMany({ userId, isActive: true }, { isActive: false });

    const newPlanData = await aiService.generateDietPlan(userId, profile);
    dietPlan = await DietPlan.create(newPlanData);
  }

  res.status(200).json(
    ApiResponse.success('Diet plan retrieved successfully', { dietPlan })
  );
});

/**
 * POST /api/v1/ai/chat
 * Send chat message to AI coach with history
 */
const chatWithCoach = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { message, history } = req.body;

  if (!message || !message.trim()) {
    return next(new AppError('Message is required.', 400));
  }

  const profile = await Profile.findOne({ userId });
  if (!profile) {
    return next(new AppError('Profile not found. Please complete onboarding first.', 404));
  }

  const responseText = await aiService.chatWithCoach(
    userId,
    req.user,
    profile,
    message,
    history || []
  );

  res.status(200).json(
    ApiResponse.success('Coach response received successfully', { response: responseText })
  );
});

module.exports = {
  getWorkoutPlan,
  getDietPlan,
  chatWithCoach
};
