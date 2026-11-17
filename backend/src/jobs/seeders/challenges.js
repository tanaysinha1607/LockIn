const { Challenge, Badge } = require('../../models');
const { CHALLENGE_TYPES, CHALLENGE_CATEGORIES, CHALLENGE_STATUS } = require('../../config/constants');

const DAY_MS = 24 * 60 * 60 * 1000;

const buildDefaults = async () => {
  // Badges are optional rewards; seed badges first so these resolve
  const warriorBadge = await Badge.findOne({ name: '7-Day Warrior' });
  const lockInBadge = await Badge.findOne({ name: 'Lock-In Legends' });
  const junkieBadge = await Badge.findOne({ name: 'Gym Junkie' });

  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); // today, UTC

  return [
    {
      title: 'Consistent Week',
      description: 'Keep a daily gym check-in streak of 7 days.',
      type: CHALLENGE_TYPES.STREAK,
      category: CHALLENGE_CATEGORIES.GENERAL,
      target: 7,
      duration: 7,
      startDate,
      endDate: new Date(startDate.getTime() + 7 * DAY_MS),
      status: CHALLENGE_STATUS.ACTIVE,
      rewards: { xp: 500, badgeId: warriorBadge ? warriorBadge._id : null },
    },
    {
      title: 'Double Lock-In',
      description: 'Complete 5 joint workout sessions together with your buddy.',
      type: CHALLENGE_TYPES.LOCK_IN_COUNT,
      category: CHALLENGE_CATEGORIES.BUDDY,
      target: 5,
      duration: 14,
      startDate,
      endDate: new Date(startDate.getTime() + 14 * DAY_MS),
      status: CHALLENGE_STATUS.ACTIVE,
      rewards: { xp: 800, badgeId: lockInBadge ? lockInBadge._id : null },
    },
    {
      title: 'Check-In Showdown',
      description: 'Compete against your buddy. Who can check in more times in 14 days?',
      type: CHALLENGE_TYPES.BUDDY_VS_BUDDY,
      category: CHALLENGE_CATEGORIES.BUDDY,
      target: 10,
      duration: 14,
      startDate,
      endDate: new Date(startDate.getTime() + 14 * DAY_MS),
      status: CHALLENGE_STATUS.ACTIVE,
      rewards: { xp: 1000, badgeId: junkieBadge ? junkieBadge._id : null },
    },
  ];
};

/**
 * Creates the default challenges, and re-opens any of them whose window has ended so a
 * fresh dev database always has something joinable. Safe to run repeatedly.
 */
const seedChallenges = async () => {
  const defaults = await buildDefaults();
  const now = new Date();
  let created = 0;
  let refreshed = 0;

  for (const item of defaults) {
    const existing = await Challenge.findOne({ title: item.title });
    if (!existing) {
      await Challenge.create(item);
      created += 1;
    } else if (existing.endDate < now || existing.status !== CHALLENGE_STATUS.ACTIVE) {
      existing.set({
        startDate: item.startDate,
        endDate: item.endDate,
        status: CHALLENGE_STATUS.ACTIVE,
        rewards: item.rewards,
      });
      await existing.save();
      refreshed += 1;
    }
  }

  return { created, refreshed, total: defaults.length };
};

module.exports = { seedChallenges };
