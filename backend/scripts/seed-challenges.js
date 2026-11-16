require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const connectDB = require('../src/config/database');
const { Challenge, Badge } = require('../src/models');
const { CHALLENGE_TYPES, CHALLENGE_CATEGORIES, CHALLENGE_STATUS } = require('../src/config/constants');

async function run() {
  await connectDB();
  console.log('Connected to Database. Seeding challenges...');

  // Find badges for rewards
  const warriorBadge = await Badge.findOne({ name: '7-Day Warrior' });
  const lockInBadge = await Badge.findOne({ name: 'Lock-In Legends' });
  const junkieBadge = await Badge.findOne({ name: 'Gym Junkie' });

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // start of today
  const endDate1 = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days
  const endDate2 = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000); // +14 days

  const defaults = [
    {
      title: 'Consistent Week',
      description: 'Keep a daily gym check-in streak of 7 days.',
      type: CHALLENGE_TYPES.STREAK,
      category: CHALLENGE_CATEGORIES.GENERAL,
      target: 7,
      duration: 7,
      startDate,
      endDate: endDate1,
      status: CHALLENGE_STATUS.ACTIVE,
      rewards: {
        xp: 500,
        badgeId: warriorBadge ? warriorBadge._id : null,
      },
    },
    {
      title: 'Double Lock-In',
      description: 'Complete 5 joint workout sessions together with your buddy.',
      type: CHALLENGE_TYPES.LOCK_IN_COUNT,
      category: CHALLENGE_CATEGORIES.BUDDY,
      target: 5,
      duration: 14,
      startDate,
      endDate: endDate2,
      status: CHALLENGE_STATUS.ACTIVE,
      rewards: {
        xp: 800,
        badgeId: lockInBadge ? lockInBadge._id : null,
      },
    },
    {
      title: 'Check-In Showdown',
      description: 'Compete against your buddy. Who can check in more times in 14 days?',
      type: CHALLENGE_TYPES.BUDDY_VS_BUDDY,
      category: CHALLENGE_CATEGORIES.BUDDY,
      target: 10,
      duration: 14,
      startDate,
      endDate: endDate2,
      status: CHALLENGE_STATUS.ACTIVE,
      rewards: {
        xp: 1000,
        badgeId: junkieBadge ? junkieBadge._id : null,
      },
    },
  ];

  let seededCount = 0;
  for (const item of defaults) {
    const existing = await Challenge.findOne({ title: item.title });
    if (!existing) {
      await Challenge.create(item);
      seededCount++;
    }
  }

  console.log(`Successfully seeded challenges: ${seededCount} new challenges created.`);
  process.exit(0);
}

run().catch(err => {
  console.error('Failed to seed challenges:', err);
  process.exit(1);
});
