const CheckIn = require('../models/CheckIn');
const Streak = require('../models/Streak');
const Profile = require('../models/Profile');
const ActivityLog = require('../models/ActivityLog');
const AppError = require('../utils/AppError');
const { notify } = require('./notification.service');
const { logger } = require('../utils/logger');
const { ACTIVITY_LOG_ACTIONS } = require('../config/constants');
const { todayUTC, addDaysUTC } = require('../utils/date');
const { awardXp } = require('../utils/xp');
const { distanceMeters, isValidCoordinates } = require('../utils/geo');
const config = require('../config/environment');
const { getAccountabilitySummary } = require('./accountability.service');

const BASE_XP = 150;
const SESSION_BONUS_XP = 100;

const STREAK_MILESTONES = {
  3: 50,
  7: 150,
  14: 300,
  30: 700,
  60: 1200,
  100: 2000,
};

const computeStreakStartDate = (endDate, length) => {
  // endDate is inclusive; length >= 1
  return addDaysUTC(endDate, -(length - 1));
};

// GPS fixes are noisy; give the user credit for up to this much reported inaccuracy
const MAX_ACCURACY_ALLOWANCE_M = 100;

/**
 * Returns a GeoJSON Point only when the client sent a usable [lng, lat] pair.
 * Storing `{ type: 'Point', coordinates: [] }` breaks the 2dsphere index on CheckIn.
 */
const normalizeLocation = (location) => {
  const coords = location?.coordinates;
  return isValidCoordinates(coords) ? { type: 'Point', coordinates: coords } : undefined;
};

/**
 * Decides whether a check-in is at the user's gym.
 *
 * - Coordinates sent: must be within the radius (plus up to 100 m of reported GPS accuracy)
 *   of the saved gym, otherwise the check-in is refused with code TOO_FAR_FROM_GYM.
 * - No coordinates: refused with code LOCATION_REQUIRED when GPS is required (production
 *   default), otherwise accepted but stored as unverified.
 *
 * @returns {{ location, isVerified: boolean, distanceFromGym: number|null, locationAccuracy: number|null }}
 */
const verifyCheckInLocation = (profile, rawLocation) => {
  const location = normalizeLocation(rawLocation);
  const accuracy = Number.isFinite(rawLocation?.accuracy) ? Math.round(rawLocation.accuracy) : null;
  const { radiusMeters, requireGps } = config.checkIn;

  if (!location) {
    if (requireGps) {
      throw new AppError(
        'Turn on location so we can confirm you are at your gym.',
        400,
        'LOCATION_REQUIRED'
      );
    }
    return { location: undefined, isVerified: false, distanceFromGym: null, locationAccuracy: null };
  }

  const gymCoords = profile.gymLocation?.coordinates;
  if (!isValidCoordinates(gymCoords)) {
    throw new AppError('Set your gym location in your profile before checking in.', 400, 'GYM_NOT_SET');
  }

  const distance = Math.round(distanceMeters(location.coordinates, gymCoords));
  const allowed = radiusMeters + Math.min(accuracy ?? 0, MAX_ACCURACY_ALLOWANCE_M);

  if (distance > allowed) {
    const away = distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance} m`;
    throw new AppError(
      `You are ${away} from ${profile.gymName || 'your gym'}. Check in when you get there.`,
      400,
      'TOO_FAR_FROM_GYM'
    );
  }

  return { location, isVerified: true, distanceFromGym: distance, locationAccuracy: accuracy };
};

/**
 * Completes any confirmed buddy sessions scheduled for today where the buddy has also
 * checked in. Awards bonus XP to both, bumps the match lockInCount, notifies both users.
 */
const completeTodaysSessions = async (userId, today, checkInDoc) => {
  const Session = require('../models/Session');
  const Match = require('../models/Match');
  const User = require('../models/User');
  const Notification = require('../models/Notification');
  const { SESSION_STATUS, NOTIFICATION_TYPES } = require('../config/constants');
  const { calculateHaversineDistance } = require('./buddyRequest.service');
  const challengeService = require('./challenge.service');
  const badgeService = require('./badge.service');

  const sessions = await Session.find({
    participants: userId,
    status: SESSION_STATUS.CONFIRMED,
    scheduledDate: {
      $gte: new Date(`${today}T00:00:00.000Z`),
      $lte: new Date(`${today}T23:59:59.999Z`),
    },
  });

  for (const session of sessions) {
    const buddyId = session.participants.find((p) => String(p) !== String(userId));
    if (!buddyId) continue;

    const buddyCheckIn = await CheckIn.findOne({ userId: buddyId, date: today });
    if (!buddyCheckIn) continue;

    // If both check-ins carry coordinates, require them to be within 500 m of each other
    if (checkInDoc.location?.coordinates?.length === 2 && buddyCheckIn.location?.coordinates?.length === 2) {
      const distanceKm = calculateHaversineDistance(
        checkInDoc.location.coordinates,
        buddyCheckIn.location.coordinates
      );
      if (distanceKm > 0.5) continue;
    }

    // Claim the session atomically so two simultaneous check-ins can't both award the bonus
    const claimed = await Session.findOneAndUpdate(
      { _id: session._id, status: SESSION_STATUS.CONFIRMED },
      { $set: { status: SESSION_STATUS.COMPLETED } },
      { new: true }
    );
    if (!claimed) continue;

    await Promise.all([awardXp(userId, SESSION_BONUS_XP), awardXp(buddyId, SESSION_BONUS_XP)]);
    await Match.updateOne({ _id: session.matchId }, { $inc: { lockInCount: 1 } });

    const [userA, userB] = await Promise.all([User.findById(userId), User.findById(buddyId)]);
    const nameA = userA ? userA.firstName : 'Your buddy';
    const nameB = userB ? userB.firstName : 'Your buddy';

    await Promise.all([
      notify({
        userId,
        type: NOTIFICATION_TYPES.LOCK_IN,
        title: 'Lock-In Complete! 🔒🔥',
        body: `You completed your workout "${session.title}" with ${nameB} and earned +${SESSION_BONUS_XP} XP!`,
        data: { sessionId: session._id, matchId: session.matchId },
      }),
      notify({
        userId: buddyId,
        type: NOTIFICATION_TYPES.LOCK_IN,
        title: 'Lock-In Complete! 🔒🔥',
        body: `You completed your workout "${session.title}" with ${nameA} and earned +${SESSION_BONUS_XP} XP!`,
        data: { sessionId: session._id, matchId: session.matchId },
      }),
    ]);

    await Promise.all([
      ActivityLog.create({
        userId,
        action: ACTIVITY_LOG_ACTIONS.SESSION_COMPLETED,
        xpChange: SESSION_BONUS_XP,
        metadata: { sessionId: session._id, buddyId },
      }),
      ActivityLog.create({
        userId: buddyId,
        action: ACTIVITY_LOG_ACTIONS.SESSION_COMPLETED,
        xpChange: SESSION_BONUS_XP,
        metadata: { sessionId: session._id, buddyId: userId },
      }),
    ]).catch(() => {});

    // Buddy's challenge progress & badges also move when a session completes
    await challengeService.evaluateUserChallenges(buddyId).catch(() => {});
    await badgeService.checkAndAwardBadges(buddyId).catch(() => {});
  }

  await challengeService.evaluateUserChallenges(userId).catch(() => {});
  await badgeService.checkAndAwardBadges(userId).catch(() => {});
};

/**
 * Creates a daily check-in (once per day), updates streak, XP, and consistency metrics.
 */
const createDailyCheckIn = async (userId, checkInBody = {}) => {
  const today = todayUTC();

  const gymProfile = await Profile.findOne({ userId }).select('gymLocation gymName').lean();
  if (!gymProfile) {
    throw new AppError('Profile not found. Please complete onboarding first.', 404);
  }

  let streak = await Streak.findOne({ userId });
  if (!streak) {
    streak = await Streak.create({ userId });
  }

  if (streak.lastCheckInDate === today) {
    throw new AppError('You have already checked in today.', 400);
  }

  const yesterday = addDaysUTC(today, -1);

  let nextCurrentStreak = 1;
  let streakReset = false;

  if (streak.lastCheckInDate === yesterday) {
    nextCurrentStreak = (streak.currentStreak || 0) + 1;
  } else if (streak.lastCheckInDate) {
    // missed at least one day -> finalize previous streak segment
    if ((streak.currentStreak || 0) > 0) {
      const endDate = streak.lastCheckInDate;
      const startDate = computeStreakStartDate(endDate, streak.currentStreak);
      streak.streakHistory = streak.streakHistory || [];
      streak.streakHistory.push({
        startDate,
        endDate,
        length: streak.currentStreak,
      });
    }
    streakReset = true;
  }

  // Location check happens before anything is written
  const verification = verifyCheckInLocation(gymProfile, checkInBody.location);

  const milestoneBonus = STREAK_MILESTONES[nextCurrentStreak] || 0;
  const xpEarned = BASE_XP + milestoneBonus;

  let checkInDoc;
  try {
    checkInDoc = await CheckIn.create({
      userId,
      date: today,
      checkInTime: new Date(),
      location: verification.location,
      distanceFromGym: verification.distanceFromGym,
      locationAccuracy: verification.locationAccuracy,
      mood: checkInBody.mood ?? null,
      notes: checkInBody.notes ?? '',
      workoutType: checkInBody.workoutType ?? null,
      xpEarned,
      isVerified: verification.isVerified,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      throw new AppError('You have already checked in today.', 400);
    }
    throw err;
  }

  // Update streak doc
  streak.currentStreak = nextCurrentStreak;
  streak.longestStreak = Math.max(streak.longestStreak || 0, nextCurrentStreak);
  streak.lastCheckInDate = today;
  streak.totalCheckIns = (streak.totalCheckIns || 0) + 1;

  // Weekly/monthly counters and consistency score (based on last 7/30 days, includes today)
  const summary = await getAccountabilitySummary(userId, today);
  streak.weeklyCheckIns = summary.metrics.weeklyCheckIns;
  streak.monthlyCheckIns = summary.metrics.monthlyCheckIns;

  await Promise.all([
    streak.save(),
    Profile.updateOne({ userId }, { $set: { consistencyScore: summary.metrics.computedConsistencyScore } }),
    awardXp(userId, xpEarned),
  ]);

  // Sessions, challenges and badges (best-effort: a failure here must not undo the check-in)
  try {
    await completeTodaysSessions(userId, today, checkInDoc);
  } catch (err) {
    logger.error(`Check-in follow-up (sessions/challenges/badges) failed for ${userId}: ${err.message}`);
  }

  ActivityLog.create({
    userId,
    action: ACTIVITY_LOG_ACTIONS.CHECK_IN,
    xpChange: xpEarned,
    metadata: {
      date: today,
      baseXp: BASE_XP,
      milestoneBonus,
      currentStreak: nextCurrentStreak,
      longestStreak: streak.longestStreak,
      streakReset,
    },
  }).catch(() => {});

  // Re-read so the response includes session/badge/challenge XP awarded above
  const [profile, finalSummary] = await Promise.all([
    Profile.findOne({ userId }),
    getAccountabilitySummary(userId, today),
  ]);

  return {
    checkIn: checkInDoc,
    streak,
    profile,
    summary: finalSummary,
  };
};

module.exports = {
  createDailyCheckIn,
  normalizeLocation,
  verifyCheckInLocation,
};
