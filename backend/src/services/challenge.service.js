const { Challenge, ChallengeParticipation, Streak, CheckIn, Session, Profile, Match, User, Notification, ActivityLog } = require('../models');
const AppError = require('../utils/AppError');
const { notify } = require('./notification.service');
const { CHALLENGE_TYPES, CHALLENGE_STATUS, PARTICIPATION_STATUS, NOTIFICATION_TYPES, ACTIVITY_LOG_ACTIONS } = require('../config/constants');
const { formatUTCDate } = require('../utils/date');
const { awardXp } = require('../utils/xp');

// Challenge dates are stored as Date; check-in dates are 'YYYY-MM-DD' strings in UTC.
const toDateKey = (d) => formatUTCDate(new Date(d));

/**
 * Get all available challenges (active/upcoming) and annotate if user joined
 */
const getChallenges = async (userId) => {
  const challenges = await Challenge.find({
    status: { $in: [CHALLENGE_STATUS.ACTIVE, CHALLENGE_STATUS.UPCOMING] },
  }).sort({ startDate: 1 });

  // Get user's participations
  const participations = await ChallengeParticipation.find({ userId });
  const joinedChallengeIds = new Set(participations.map(p => String(p.challengeId)));

  const result = challenges.map(c => {
    const isJoined = joinedChallengeIds.has(String(c._id));
    const participation = isJoined ? participations.find(p => String(p.challengeId) === String(c._id)) : null;

    return {
      challenge: c,
      isJoined,
      participationStatus: participation ? participation.status : null,
      progress: participation ? participation.progress : 0,
    };
  });

  return result;
};

/**
 * Join a challenge
 */
const joinChallenge = async (userId, challengeId) => {
  const challenge = await Challenge.findById(challengeId);
  if (!challenge) {
    throw new AppError('Challenge not found.', 404);
  }

  if (challenge.status === CHALLENGE_STATUS.COMPLETED || challenge.status === CHALLENGE_STATUS.CANCELLED) {
    throw new AppError('Cannot join a challenge that has ended or been cancelled.', 400);
  }

  // Check if already joined
  const existing = await ChallengeParticipation.findOne({ challengeId, userId });
  if (existing) {
    throw new AppError('You have already joined this challenge.', 400);
  }

  // Check capacity
  if (challenge.maxParticipants && challenge.participantCount >= challenge.maxParticipants) {
    throw new AppError('Challenge is full.', 400);
  }

  // If buddy co-op or competitive, check if user has active match
  if (challenge.type === CHALLENGE_TYPES.LOCK_IN_COUNT || challenge.type === CHALLENGE_TYPES.BUDDY_VS_BUDDY) {
    const activeMatch = await Match.findOne({ users: userId, status: 'active' });
    if (!activeMatch) {
      throw new AppError('You need an active gym buddy to join buddy/competitive challenges.', 400);
    }
  }

  // Create participation
  const participation = await ChallengeParticipation.create({
    challengeId,
    userId,
    target: challenge.target,
    status: PARTICIPATION_STATUS.IN_PROGRESS,
    progress: 0,
  });

  // Increment participant count
  await Challenge.updateOne({ _id: challenge._id }, { $inc: { participantCount: 1 } });

  // Log activity
  await ActivityLog.create({
    userId,
    action: ACTIVITY_LOG_ACTIONS.CHALLENGE_JOINED,
    metadata: {
      challengeId,
      challengeTitle: challenge.title,
    },
  }).catch(() => {});

  // Trigger immediate initial progress evaluation
  await updateSingleParticipationProgress(userId, participation, challenge);

  return participation;
};

/**
 * Get current user's joined challenges
 */
const getMyChallenges = async (userId) => {
  const participations = await ChallengeParticipation.find({ userId })
    .populate('challengeId')
    .sort({ createdAt: -1 });

  return participations;
};

/**
 * Get leaderboard for a specific challenge
 */
const getChallengeLeaderboard = async (challengeId) => {
  const participations = await ChallengeParticipation.find({ challengeId })
    .populate('userId', 'firstName lastName avatar gender')
    .sort({ progress: -1, completedAt: 1 })
    .limit(50);

  return participations;
};

/**
 * Update progress for a single participation document
 */
const updateSingleParticipationProgress = async (userId, participation, challenge) => {
  if (participation.status !== PARTICIPATION_STATUS.IN_PROGRESS) return;

  const now = new Date();
  let progress = 0;

  if (challenge.type === CHALLENGE_TYPES.STREAK) {
    const streak = await Streak.findOne({ userId });
    progress = streak ? streak.currentStreak : 0;
  } else if (challenge.type === CHALLENGE_TYPES.CHECK_IN_COUNT) {
    // Count check-ins in timeframe
    progress = await CheckIn.countDocuments({
      userId,
      date: {
        $gte: toDateKey(challenge.startDate),
        $lte: toDateKey(challenge.endDate),
      },
    });
  } else if (challenge.type === CHALLENGE_TYPES.LOCK_IN_COUNT) {
    // Count completed sessions for this user's matches in timeframe
    const matches = await Match.find({ users: userId, status: 'active' });
    const matchIds = matches.map(m => m._id);

    progress = await Session.countDocuments({
      matchId: { $in: matchIds },
      status: 'completed',
      scheduledDate: {
        $gte: challenge.startDate,
        $lte: challenge.endDate,
      },
    });
  } else if (challenge.type === CHALLENGE_TYPES.BUDDY_VS_BUDDY) {
    // Progress is user's check-ins during timeframe
    progress = await CheckIn.countDocuments({
      userId,
      date: {
        $gte: toDateKey(challenge.startDate),
        $lte: toDateKey(challenge.endDate),
      },
    });
  }

  participation.progress = progress;

  // For non-competitive challenges, verify if target met
  if (challenge.type !== CHALLENGE_TYPES.BUDDY_VS_BUDDY && progress >= challenge.target) {
    participation.status = PARTICIPATION_STATUS.COMPLETED;
    participation.completedAt = now;
    participation.xpEarned = challenge.rewards?.xp || 0;

    // Award XP and level up atomically
    await awardXp(userId, challenge.rewards?.xp || 0);

    // Award Badge if specified (importing dynamically to avoid circular dependency)
    if (challenge.rewards?.badgeId) {
      const badgeService = require('./badge.service');
      await badgeService.awardBadgeDirectly(userId, challenge.rewards.badgeId).catch(err => {
        console.error('Failed to award challenge badge:', err);
      });
    }

    // Create Notification
    await notify({
      userId,
      type: NOTIFICATION_TYPES.CHALLENGE_UPDATE,
      title: 'Challenge Completed! 🏆',
      body: `Congratulations! You completed the "${challenge.title}" challenge and earned ${challenge.rewards?.xp || 0} XP!`,
      data: { challengeId: challenge._id },
    });

    // Log activity
    await ActivityLog.create({
      userId,
      action: ACTIVITY_LOG_ACTIONS.CHALLENGE_COMPLETED,
      xpChange: challenge.rewards?.xp || 0,
      metadata: {
        challengeId: challenge._id,
        challengeTitle: challenge.title,
      },
    }).catch(() => {});
  }

  await participation.save();
};

/**
 * Trigger update for all in-progress challenges of a user
 */
const evaluateUserChallenges = async (userId) => {
  const participations = await ChallengeParticipation.find({
    userId,
    status: PARTICIPATION_STATUS.IN_PROGRESS,
  }).populate('challengeId');

  for (const p of participations) {
    if (p.challengeId) {
      await updateSingleParticipationProgress(userId, p, p.challengeId);
    }
  }
};

/**
 * Periodically evaluate all challenges (system cron / trigger)
 */
const evaluateAllChallenges = async () => {
  const now = new Date();

  // 1. Move upcoming challenges to active, active to completed based on dates
  await Challenge.updateMany(
    { status: CHALLENGE_STATUS.UPCOMING, startDate: { $lte: now } },
    { status: CHALLENGE_STATUS.ACTIVE }
  );

  const completedChallenges = await Challenge.find({
    status: CHALLENGE_STATUS.ACTIVE,
    endDate: { $lt: now },
  });

  for (const challenge of completedChallenges) {
    challenge.status = CHALLENGE_STATUS.COMPLETED;
    await challenge.save();

    // Find all participations that are still IN_PROGRESS for this completed challenge
    const participations = await ChallengeParticipation.find({
      challengeId: challenge._id,
      status: PARTICIPATION_STATUS.IN_PROGRESS,
    });

    for (const p of participations) {
      // If competitive challenge, evaluate buddy vs buddy
      if (challenge.type === CHALLENGE_TYPES.BUDDY_VS_BUDDY) {
        const activeMatch = await Match.findOne({ users: p.userId, status: 'active' });
        const buddyId = activeMatch ? activeMatch.users.find(id => String(id) !== String(p.userId)) : null;

        if (buddyId) {
          // Find buddy's progress in this challenge
          const buddyParticipation = await ChallengeParticipation.findOne({
            challengeId: challenge._id,
            userId: buddyId,
          });

          // Compute latest progress for both
          const userProgress = p.progress;
          const buddyProgress = buddyParticipation ? buddyParticipation.progress : 0;

          if (userProgress > buddyProgress) {
            // User won
            p.status = PARTICIPATION_STATUS.COMPLETED;
            p.completedAt = now;
            p.xpEarned = challenge.rewards?.xp || 0;

            await awardXp(p.userId, challenge.rewards?.xp || 0);

            await notify({
              userId: p.userId,
              type: NOTIFICATION_TYPES.CHALLENGE_UPDATE,
              title: 'Challenge Won! 🥇',
              body: `You beat your buddy in the "${challenge.title}" challenge and earned ${challenge.rewards?.xp || 0} XP!`,
              data: { challengeId: challenge._id },
            });
          } else {
            // User lost or tied (only strictly higher progress wins, or we can tie)
            p.status = PARTICIPATION_STATUS.FAILED;
            await notify({
              userId: p.userId,
              type: NOTIFICATION_TYPES.CHALLENGE_UPDATE,
              title: 'Challenge Ended 🏁',
              body: `The "${challenge.title}" challenge has ended. You did not beat your buddy.`,
              data: { challengeId: challenge._id },
            });
          }
        } else {
          // No active buddy, user fails
          p.status = PARTICIPATION_STATUS.FAILED;
        }
      } else {
        // Standard challenges: if target is met, mark completed, else failed
        if (p.progress >= challenge.target) {
          p.status = PARTICIPATION_STATUS.COMPLETED;
          p.completedAt = now;
          p.xpEarned = challenge.rewards?.xp || 0;

          await awardXp(p.userId, challenge.rewards?.xp || 0);

          await notify({
            userId: p.userId,
            type: NOTIFICATION_TYPES.CHALLENGE_UPDATE,
            title: 'Challenge Completed! 🏆',
            body: `Congratulations! You completed "${challenge.title}" and earned ${challenge.rewards?.xp || 0} XP!`,
            data: { challengeId: challenge._id },
          });
        } else {
          p.status = PARTICIPATION_STATUS.FAILED;
        }
      }
      await p.save();
    }
  }

  return { evaluatedCount: completedChallenges.length };
};

module.exports = {
  getChallenges,
  joinChallenge,
  getMyChallenges,
  getChallengeLeaderboard,
  evaluateUserChallenges,
  evaluateAllChallenges,
};
