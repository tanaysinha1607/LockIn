const userService = require('../services/user.service');
const Profile = require('../models/Profile');
const accountabilityService = require('../services/accountability.service');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

/**
 * Get current user profile and user details
 */
const getMe = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ userId: req.user._id });
  const accountability = await accountabilityService.getAccountabilitySummary(req.user._id);
  
  res.status(200).json(
    ApiResponse.success('User retrieved successfully', {
      user: req.user,
      profile: profile || null,
      accountability,
    })
  );
});

/**
 * Create or update user profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const result = await userService.updateUserProfile(req.user._id, req.body);

  res.status(200).json(
    ApiResponse.success('Profile updated successfully', {
      user: result.user,
      profile: result.profile,
    })
  );
});

/**
 * PUT /api/v1/users/gym-location - move your gym (rate-limited by a cooldown)
 */
const updateGymLocation = asyncHandler(async (req, res) => {
  const profile = await userService.updateGymLocation(req.user._id, req.body);
  res.status(200).json(ApiResponse.success('Gym location updated', { profile }));
});

/**
 * GET /api/v1/users/me/recap?week=current|last
 */
const getWeeklyRecap = asyncHandler(async (req, res) => {
  const { getWeeklyRecap: build } = require('../services/recap.service');
  const recap = await build(req.user._id, { week: req.query.week });
  res.status(200).json(ApiResponse.success('Weekly recap', { recap }));
});

module.exports = {
  getWeeklyRecap,
  updateGymLocation,
  getMe,
  updateProfile,
};
