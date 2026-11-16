const User = require('../models/User');
const Profile = require('../models/Profile');
const AppError = require('../utils/AppError');

/**
 * Get user by id
 * @param {string} id 
 * @returns {Promise<Object>} user
 */
const getUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
};

/**
 * Get profile by user id
 * @param {string} userId 
 * @returns {Promise<Object>} profile
 */
const getUserProfile = async (userId) => {
  const profile = await Profile.findOne({ userId });
  if (!profile) {
    throw new AppError('Profile not found. Please complete onboarding first.', 404);
  }
  return profile;
};

/**
 * Create or update user profile and set isOnboarded = true
 * @param {string} userId 
 * @param {Object} profileBody 
 * @returns {Promise<Object>} updated profile and user
 */
const updateUserProfile = async (userId, profileBody) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Handle GeoJSON format if not already in Point format
  if (profileBody.gymLocation && !profileBody.gymLocation.type) {
    profileBody.gymLocation.type = 'Point';
  }

  let profile = await Profile.findOne({ userId });

  if (profile) {
    // Update existing profile
    Object.assign(profile, profileBody);
    await profile.save();
  } else {
    // Create new profile
    profile = await Profile.create({
      userId,
      ...profileBody,
    });
  }

  // Update user onboarding state if not already onboarded
  if (!user.isOnboarded) {
    user.isOnboarded = true;
    await user.save();
  }

  return {
    user,
    profile,
  };
};

module.exports = {
  getUserById,
  getUserProfile,
  updateUserProfile,
};
