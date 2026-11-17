const User = require('../models/User');
const Profile = require('../models/Profile');
const AppError = require('../utils/AppError');
const config = require('../config/environment');
const { distanceMeters } = require('../utils/geo');

// Moves smaller than this are GPS jitter, not a new gym
const SAME_GYM_METERS = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Throws if the user changed their gym too recently. Without a cooldown, GPS check-in
 * could be beaten by setting your "gym" to wherever you are before checking in.
 */
const assertGymChangeAllowed = (profile) => {
  const cooldownDays = config.checkIn.gymLocationCooldownDays;
  if (!profile.gymLocationUpdatedAt || cooldownDays === 0) return;

  const nextAllowed = new Date(profile.gymLocationUpdatedAt.getTime() + cooldownDays * DAY_MS);
  if (nextAllowed > new Date()) {
    throw new AppError(
      `You can only change your gym once every ${cooldownDays} days. You can change it again on ${nextAllowed.toDateString()}.`,
      429
    );
  }
};

const isNewGymLocation = (profile, coordinates) => {
  const current = profile?.gymLocation?.coordinates;
  if (!Array.isArray(current) || current.length !== 2) return true;
  return distanceMeters(current, coordinates) > SAME_GYM_METERS;
};

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

  const newCoords = profileBody.gymLocation?.coordinates;

  if (profile) {
    if (newCoords && isNewGymLocation(profile, newCoords)) {
      assertGymChangeAllowed(profile);
      profileBody.gymLocationUpdatedAt = new Date();
    }

    // Update existing profile
    Object.assign(profile, profileBody);
    await profile.save();
  } else {
    // Create new profile
    profile = await Profile.create({
      userId,
      ...profileBody,
      gymLocationUpdatedAt: newCoords ? new Date() : null,
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

/**
 * Set the gym to a new point (usually the device's current position, while at the gym).
 * Limited to once per cooldown period.
 */
const updateGymLocation = async (userId, { coordinates, gymName, gymAddress }) => {
  const profile = await getUserProfile(userId);

  if (isNewGymLocation(profile, coordinates)) {
    assertGymChangeAllowed(profile);
    profile.gymLocation = { type: 'Point', coordinates };
    profile.gymLocationUpdatedAt = new Date();
  }
  if (gymName !== undefined) profile.gymName = gymName;
  if (gymAddress !== undefined) profile.gymAddress = gymAddress;

  await profile.save();
  return profile;
};

module.exports = {
  updateGymLocation,
  getUserById,
  getUserProfile,
  updateUserProfile,
};
