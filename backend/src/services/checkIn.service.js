const CheckIn = require('../models/CheckIn');
const Streak = require('../models/Streak');
const Profile = require('../models/Profile');
const ActivityLog = require('../models/ActivityLog');
const AppError = require('../utils/AppError');
const { ACTIVITY_LOG_ACTIONS } = require('../config/constants');
const { todayUTC, addDaysUTC } = require('../utils/date');
const { getAccountabilitySummary } = require('./accountability.service');

const BASE_XP = 150;

const STREAK_MILESTONES = {
  3: 50,
  7: 150,
  14: 300,
  30: 700,
  60: 1200,
  100: 2000,
};

const calcLevel = (level, xp) => {
  let currentLevel = Math.max(1, level || 1);
  let nextThreshold = currentLevel * 1000;
  while (xp >= nextThreshold) {
    currentLevel += 1;
    nextThreshold = currentLevel * 1000;
  }
  return currentLevel;
};

const computeStreakStartDate = (endDate, length) => {
  // endDate is inclusive; length >= 1
  return addDaysUTC(endDate, -(length - 1));
};

/**
 * Creates a daily check-in (once per day), updates streak, XP, and consistency metrics.
 */
const createDailyCheckIn = async (userId, checkInBody = {}) => {
  const today = todayUTC();

  const profile = await Profile.findOne({ userId });
  if (!profile) {
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

  const milestoneBonus = STREAK_MILESTONES[nextCurrentStreak] || 0;
  const xpEarned = BASE_XP + milestoneBonus;

  let checkInDoc;
  try {
    checkInDoc = await CheckIn.create({
      userId,
      date: today,
      checkInTime: new Date(),
      location: checkInBody.location,
      mood: checkInBody.mood ?? null,
      notes: checkInBody.notes ?? '',
      workoutType: checkInBody.workoutType ?? null,
      xpEarned,
      isVerified: true,
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

  // Update XP & level in profile
  profile.xp = (profile.xp || 0) + xpEarned;
  profile.level = calcLevel(profile.level, profile.xp);

  // Update weekly/monthly counters and consistency score (based on last 7/30 days)
  const summary = await getAccountabilitySummary(userId, today);
  streak.weeklyCheckIns = summary.metrics.weeklyCheckIns;
  streak.monthlyCheckIns = summary.metrics.monthlyCheckIns;
  profile.consistencyScore = summary.metrics.computedConsistencyScore;

  await Promise.all([streak.save(), profile.save()]);

  // Phase 5 Integrations: Sessions, Challenges, and Badges
  try {
    const Session = require('../models/Session');
    const Match = require('../models/Match');
    const User = require('../models/User');
    const Notification = require('../models/Notification');
    const { SESSION_STATUS, NOTIFICATION_TYPES } = require('../config/constants');
    const { calculateHaversineDistance } = require('./buddyRequest.service');
    const challengeService = require('./challenge.service');
    const badgeService = require('./badge.service');

    // 1. Check for confirmed workout sessions scheduled for today
    const sessions = await Session.find({
      participants: userId,
      status: SESSION_STATUS.CONFIRMED,
      scheduledDate: {
        $gte: new Date(today + 'T00:00:00.000Z'),
        $lte: new Date(today + 'T23:59:59.999Z'),
      },
    });

    for (const session of sessions) {
      const buddyId = session.participants.find(p => String(p) !== String(userId));
      
      // Check if buddy checked in today
      const buddyCheckIn = await CheckIn.findOne({ userId: buddyId, date: today });
      
      if (buddyCheckIn) {
        let verified = true;
        
        // If coordinates exist, check distance < 500m
        if (checkInDoc.location?.coordinates && buddyCheckIn.location?.coordinates) {
          const distance = calculateHaversineDistance(
            checkInDoc.location.coordinates,
            buddyCheckIn.location.coordinates
          );
          if (distance > 0.5) {
            verified = false;
          }
        }

        if (verified) {
          session.status = SESSION_STATUS.COMPLETED;
          await session.save();

          // Award +100 XP to both
          const [profileA, profileB] = await Promise.all([
            Profile.findOne({ userId }),
            Profile.findOne({ userId: buddyId }),
          ]);

          if (profileA) {
            profileA.xp = (profileA.xp || 0) + 100;
            profileA.level = calcLevel(profileA.level, profileA.xp);
            await profileA.save();
          }

          if (profileB) {
            profileB.xp = (profileB.xp || 0) + 100;
            profileB.level = calcLevel(profileB.level, profileB.xp);
            await profileB.save();
          }

          // Increment mutual Match lockInCount
          const match = await Match.findOne({ _id: session.matchId });
          if (match) {
            match.lockInCount = (match.lockInCount || 0) + 1;
            await match.save();
          }

          // Create notification for both
          const userA = await User.findById(userId);
          const userB = await User.findById(buddyId);

          const nameA = userA ? userA.firstName : 'Your buddy';
          const nameB = userB ? userB.firstName : 'Your buddy';

          await Promise.all([
            Notification.create({
              userId,
              type: NOTIFICATION_TYPES.LOCK_IN,
              title: 'Lock-In Complete! 🔒🔥',
              body: `You completed your workout "${session.title}" with ${nameB} and earned +100 XP!`,
              data: { sessionId: session._id, matchId: session.matchId },
            }),
            Notification.create({
              userId: buddyId,
              type: NOTIFICATION_TYPES.LOCK_IN,
              title: 'Lock-In Complete! 🔒🔥',
              body: `You completed your workout "${session.title}" with ${nameA} and earned +100 XP!`,
              data: { sessionId: session._id, matchId: session.matchId },
            }),
          ]);

          // Create activity logs
          await Promise.all([
            ActivityLog.create({
              userId,
              action: ACTIVITY_LOG_ACTIONS.SESSION_COMPLETED,
              xpChange: 100,
              metadata: { sessionId: session._id, buddyId },
            }),
            ActivityLog.create({
              userId: buddyId,
              action: ACTIVITY_LOG_ACTIONS.SESSION_COMPLETED,
              xpChange: 100,
              metadata: { sessionId: session._id, buddyId: userId },
            }),
          ]).catch(() => {});

          // Trigger buddy challenge progress updates & badge evaluations
          await challengeService.evaluateUserChallenges(buddyId).catch(() => {});
          await badgeService.checkAndAwardBadges(buddyId).catch(() => {});
        }
      }
    }

    // 2. Evaluate challenges for current user
    await challengeService.evaluateUserChallenges(userId).catch(() => {});

    // 3. Evaluate badges for current user
    await badgeService.checkAndAwardBadges(userId).catch(() => {});
  } catch (err) {
    console.error('Error running Phase 5 integrations in check-in service:', err);
  }

  // Activity log (best-effort)
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

  return {
    checkIn: checkInDoc,
    streak,
    profile,
    summary: await getAccountabilitySummary(userId, today),
  };
};

module.exports = {
  createDailyCheckIn,
};
