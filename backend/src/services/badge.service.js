const { Badge, UserBadge, Profile, Streak, Session, Notification, ActivityLog } = require('../models');
const AppError = require('../utils/AppError');
const { notify } = require('./notification.service');
const { NOTIFICATION_TYPES, ACTIVITY_LOG_ACTIONS } = require('../config/constants');
const { awardXp } = require('../utils/xp');


/**
 * Check user criteria against all badges and award any newly met milestones
 */
const checkAndAwardBadges = async (userId) => {
  const profile = await Profile.findOne({ userId });
  if (!profile) return [];

  const streak = await Streak.findOne({ userId });
  const totalCheckIns = streak ? (streak.totalCheckIns || 0) : 0;
  const currentStreak = streak ? (streak.currentStreak || 0) : 0;

  // Count completed sessions
  const completedSessionsCount = await Session.countDocuments({
    participants: userId,
    status: 'completed',
  });

  // Load earned badges
  const earnedBadges = await UserBadge.find({ userId }).select('badgeId');
  const earnedSet = new Set(earnedBadges.map(eb => String(eb.badgeId)));

  // Load all system badges
  const systemBadges = await Badge.find({});
  const newlyEarned = [];

  for (const badge of systemBadges) {
    if (earnedSet.has(String(badge._id))) continue;

    let qualifies = false;
    const { type, threshold } = badge.criteria || {};

    if (type === 'current_streak' && currentStreak >= threshold) {
      qualifies = true;
    } else if (type === 'check_in_count' && totalCheckIns >= threshold) {
      qualifies = true;
    } else if (type === 'lock_in_count' && completedSessionsCount >= threshold) {
      qualifies = true;
    }

    if (qualifies) {
      await awardBadgeDirectly(userId, badge._id);
      newlyEarned.push(badge);
    }
  }

  return newlyEarned;
};

/**
 * Directly award a badge to a user and credit them the reward XP
 */
const awardBadgeDirectly = async (userId, badgeId) => {
  // Check if user already has this badge
  const existing = await UserBadge.findOne({ userId, badgeId });
  if (existing) return existing;

  const badge = await Badge.findById(badgeId);
  if (!badge) {
    throw new AppError('Badge not found.', 404);
  }

  let userBadge;
  try {
    userBadge = await UserBadge.create({
      userId,
      badgeId,
      xpAwarded: badge.xpReward,
    });
  } catch (err) {
    // Unique (userId, badgeId) index: a concurrent evaluation already awarded it
    if (err && err.code === 11000) return UserBadge.findOne({ userId, badgeId });
    throw err;
  }

  // Award XP and update level atomically
  await awardXp(userId, badge.xpReward);

  // Create Notification
  await notify({
    userId,
    type: NOTIFICATION_TYPES.BADGE_EARNED,
    title: `Badge Earned: ${badge.name}! 🏅`,
    body: `You unlocked the "${badge.name}" badge and earned ${badge.xpReward} XP!`,
    data: { badgeId: badge._id, icon: badge.icon },
  });

  // Log activity
  await ActivityLog.create({
    userId,
    action: ACTIVITY_LOG_ACTIONS.BADGE_EARNED,
    xpChange: badge.xpReward,
    metadata: {
      badgeId: badge._id,
      badgeName: badge.name,
      badgeIcon: badge.icon,
    },
  }).catch(() => {});

  return userBadge;
};

/**
 * Fetch all badges with a flag indicating if the current user has unlocked them
 */
const getBadgesState = async (userId) => {
  const [allBadges, userBadges] = await Promise.all([
    Badge.find({}).sort({ xpReward: 1 }),
    UserBadge.find({ userId }).populate('badgeId'),
  ]);

  const earnedMap = new Map(userBadges.map(ub => [String(ub.badgeId?._id || ub.badgeId), ub]));

  const badges = allBadges.map(b => {
    const isUnlocked = earnedMap.has(String(b._id));
    const earnedDetails = isUnlocked ? earnedMap.get(String(b._id)) : null;

    return {
      _id: b._id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      category: b.category,
      tier: b.tier,
      criteria: b.criteria,
      xpReward: b.xpReward,
      isUnlocked,
      earnedAt: earnedDetails ? earnedDetails.earnedAt : null,
    };
  });

  return badges;
};

/**
 * Fetch user's earned badges
 */
const getMyBadges = async (userId) => {
  const earned = await UserBadge.find({ userId })
    .populate('badgeId')
    .sort({ earnedAt: -1 });

  return earned;
};

/**
 * Seed system badges
 */
const seedBadges = async () => {
  const defaults = [
    {
      name: 'First Step',
      description: 'Log your first gym check-in.',
      icon: '👟',
      category: 'general',
      tier: 'bronze',
      criteria: { type: 'check_in_count', threshold: 1 },
      xpReward: 100,
    },
    {
      name: '7-Day Warrior',
      description: 'Keep a daily check-in streak of 7 days.',
      icon: '🔥',
      category: 'streak',
      tier: 'silver',
      criteria: { type: 'current_streak', threshold: 7 },
      xpReward: 300,
    },
    {
      name: 'Consistency King',
      description: 'Keep a daily check-in streak of 30 days.',
      icon: '👑',
      category: 'streak',
      tier: 'platinum',
      criteria: { type: 'current_streak', threshold: 30 },
      xpReward: 1500,
    },
    {
      name: 'Lock-In Rookie',
      description: 'Complete your first joint workout with a buddy.',
      icon: '🔒',
      category: 'buddy',
      tier: 'bronze',
      criteria: { type: 'lock_in_count', threshold: 1 },
      xpReward: 150,
    },
    {
      name: 'Lock-In Legends',
      description: 'Complete 10 joint workouts with buddies.',
      icon: '🛡️',
      category: 'buddy',
      tier: 'gold',
      criteria: { type: 'lock_in_count', threshold: 10 },
      xpReward: 750,
    },
    {
      name: 'Gym Junkie',
      description: 'Achieve 50 lifetime gym check-ins.',
      icon: '💪',
      category: 'general',
      tier: 'gold',
      criteria: { type: 'check_in_count', threshold: 50 },
      xpReward: 1000,
    },
    {
      name: 'Gym Legend',
      description: 'Achieve 100 lifetime gym check-ins.',
      icon: '🏆',
      category: 'general',
      tier: 'diamond',
      criteria: { type: 'check_in_count', threshold: 100 },
      xpReward: 2000,
    },
  ];

  let seededCount = 0;
  for (const item of defaults) {
    const existing = await Badge.findOne({ name: item.name });
    if (!existing) {
      await Badge.create(item);
      seededCount++;
    }
  }

  return { seededCount };
};

module.exports = {
  checkAndAwardBadges,
  awardBadgeDirectly,
  getBadgesState,
  getMyBadges,
  seedBadges,
};
