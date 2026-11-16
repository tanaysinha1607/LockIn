const Profile = require('../models/Profile');
const User = require('../models/User');
const Match = require('../models/Match');
const BuddyRequest = require('../models/BuddyRequest');
const AppError = require('../utils/AppError');
const compatibilityService = require('./compatibility.service');

/**
 * Helper to calculate age from Date of Birth
 */
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return 25; // Fallback default
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/**
 * Stage 1 & 2: Hard Filters for Gender and Age Preferences
 */
const passesHardFilters = (user, profile, candidate, candidateProfile) => {
  // 1. Gender preference (bidirectional check)
  const userPref = profile.buddyPreferences?.genderPreference?.toLowerCase() || 'any';
  const candidatePref = candidateProfile.buddyPreferences?.genderPreference?.toLowerCase() || 'any';
  const userGender = user.gender?.toLowerCase();
  const candidateGender = candidate.gender?.toLowerCase();

  if (userPref !== 'any' && userPref !== candidateGender) return false;
  if (candidatePref !== 'any' && candidatePref !== userGender) return false;

  // 2. Age range verification (bidirectional check)
  const userAge = calculateAge(user.dateOfBirth);
  const candidateAge = calculateAge(candidate.dateOfBirth);

  const userAgePref = profile.buddyPreferences?.ageRange || { min: 18, max: 50 };
  const candidateAgePref = candidateProfile.buddyPreferences?.ageRange || { min: 18, max: 50 };

  if (candidateAge < userAgePref.min || candidateAge > userAgePref.max) return false;
  if (userAge < candidateAgePref.min || userAge > candidateAgePref.max) return false;

  return true;
};

/**
 * Fetch all matching buddy suggestions for the current user.
 * Runs a 5-Stage matching pipeline.
 * 
 * @param {string} userId 
 * @returns {Promise<Array>} List of match suggestions with scoring details
 */
const getMatchSuggestions = async (userId) => {
  // Step 1: Load current user profile details
  const user = await User.findById(userId);
  const profile = await Profile.findOne({ userId });

  if (!user || !profile) {
    throw new AppError('Profile not found. Please complete onboarding first.', 404);
  }

  // Step 2: Query active buddies & pending requests to exclude them from recommendations
  const activeMatches = await Match.find({
    users: userId,
    status: 'active',
  });
  
  const connectedUserIds = new Set();
  activeMatches.forEach((m) => {
    m.users.forEach((u) => {
      if (String(u) !== String(userId)) {
        connectedUserIds.add(String(u));
      }
    });
  });

  const pendingRequests = await BuddyRequest.find({
    $or: [{ senderId: userId }, { receiverId: userId }],
    status: 'pending',
  });

  pendingRequests.forEach((req) => {
    connectedUserIds.add(String(req.senderId));
    connectedUserIds.add(String(req.receiverId));
  });

  // Step 3: Run Geospatial Aggregation (within user preference distance)
  const maxDistKm = profile.buddyPreferences?.maxDistance || 10;
  const maxDistMeters = maxDistKm * 1000;

  if (!profile.gymLocation || !profile.gymLocation.coordinates) {
    throw new AppError('User gym location coordinates are required for matching.', 400);
  }

  const nearbyCandidates = await Profile.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: profile.gymLocation.coordinates,
        },
        distanceField: 'distanceMeters',
        maxDistance: maxDistMeters,
        spherical: true,
        query: { userId: { $ne: user._id } }, // Exclude self
      },
    },
    { $limit: 100 }, // Pre-scoring pool limit
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'userDoc',
      },
    },
    { $unwind: '$userDoc' },
    {
      $match: {
        'userDoc.isActive': true,
        'userDoc.isOnboarded': true,
      },
    },
  ]);

  // Step 4 & 5: Apply Hard filters and calculate Compatibility Scores
  const suggestions = [];

  for (const candidateProfile of nearbyCandidates) {
    const candidateUser = candidateProfile.userDoc;
    const candidateIdStr = String(candidateProfile.userId);

    // Skip if already matched or request pending
    if (connectedUserIds.has(candidateIdStr)) {
      continue;
    }

    // Bidirectional gender/age validation
    if (!passesHardFilters(user, profile, candidateUser, candidateProfile)) {
      continue;
    }

    const distanceKm = candidateProfile.distanceMeters / 1000;
    
    // Core Compatibility Scoring calculation
    const compatibility = compatibilityService.calculateCompatibility(
      profile,
      candidateProfile,
      distanceKm
    );

    // Add optional boosts (New user boost, etc.)
    let finalScore = compatibility.total;
    const daysSinceCreated = (Date.now() - new Date(candidateUser.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated <= 7) {
      finalScore = Math.min(100, finalScore + 5); // +5 for new members
    }

    suggestions.push({
      user: {
        _id: candidateUser._id,
        firstName: candidateUser.firstName,
        lastName: candidateUser.lastName,
        avatar: candidateUser.avatar,
      },
      profile: {
        bio: candidateProfile.bio,
        fitnessLevel: candidateProfile.fitnessLevel,
        fitnessGoals: candidateProfile.fitnessGoals,
        workoutTypes: candidateProfile.workoutTypes,
        gymName: candidateProfile.gymName,
        gymAddress: candidateProfile.gymAddress,
        consistencyScore: candidateProfile.consistencyScore,
        commitmentType: candidateProfile.commitmentType,
      },
      distanceKm: Math.round(distanceKm * 10) / 10,
      compatibilityScore: finalScore,
      scoreBreakdown: compatibility.breakdown,
    });
  }

  // Step 6: Sort by score descending
  suggestions.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

  return suggestions;
};

module.exports = {
  getMatchSuggestions,
  calculateAge,
  passesHardFilters,
};
