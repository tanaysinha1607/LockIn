/**
 * One-stop dev seed: badges -> challenges -> demo users (with a 5-day streak for Alex).
 * Usage: npm run seed
 *
 * Safe to re-run. It only resets data belonging to the three demo accounts; it never
 * touches other users' matches, chats or check-ins (the old version wiped those
 * collections entirely, which is dangerous against a shared Atlas cluster).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const {
  User,
  Profile,
  Streak,
  CheckIn,
  BuddyRequest,
  Match,
  Conversation,
  Message,
  Session,
  ChallengeParticipation,
  UserBadge,
} = require('../models');
const badgeService = require('../services/badge.service');
const { seedChallenges } = require('./seeders/challenges');
const { todayUTC, addDaysUTC } = require('../utils/date');
const { calcLevel } = require('../utils/xp');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lockin';
const DEMO_STREAK_DAYS = 5;
const DEMO_XP_PER_CHECKIN = 150;

const DEMO_USERS = [
  {
    email: 'alex.demo@example.com',
    password: 'password123',
    firstName: 'Alex',
    lastName: 'Rivera',
    profile: {
      bio: 'Morning lifter looking for a consistent squat partner.',
      fitnessLevel: 'intermediate',
      fitnessGoals: ['muscle_gain', 'strength'],
      workoutTypes: ['weightlifting', 'hiit'],
      preferredWorkoutDays: ['monday', 'wednesday', 'friday'],
      preferredWorkoutTime: { start: '07:00', end: '09:00' },
      workoutDuration: 90,
      gymLocation: { type: 'Point', coordinates: [77.209, 28.6139] },
      gymName: 'Powerhouse Gym',
      gymAddress: 'Cyber City, Sector 4',
      consistencyScore: 88,
    },
  },
  {
    email: 'sam.demo@example.com',
    password: 'password123',
    firstName: 'Sam',
    lastName: 'Patel',
    profile: {
      bio: 'Cardio + weights. Prefer early sessions.',
      fitnessLevel: 'beginner',
      fitnessGoals: ['weight_loss', 'endurance'],
      workoutTypes: ['cardio', 'calisthenics'],
      preferredWorkoutDays: ['tuesday', 'thursday', 'saturday'],
      preferredWorkoutTime: { start: '07:30', end: '09:30' },
      workoutDuration: 60,
      gymLocation: { type: 'Point', coordinates: [77.211, 28.615] },
      gymName: 'Powerhouse Gym',
      gymAddress: 'Cyber City, Sector 4',
      consistencyScore: 72,
    },
  },
  {
    email: 'jordan.demo@example.com',
    password: 'password123',
    firstName: 'Jordan',
    lastName: 'Lee',
    profile: {
      bio: 'Advanced training — deadlift focus.',
      fitnessLevel: 'advanced',
      fitnessGoals: ['strength', 'muscle_gain'],
      workoutTypes: ['weightlifting', 'crossfit'],
      preferredWorkoutDays: ['monday', 'tuesday', 'friday'],
      preferredWorkoutTime: { start: '06:00', end: '08:00' },
      workoutDuration: 120,
      gymLocation: { type: 'Point', coordinates: [77.207, 28.612] },
      gymName: 'Iron District',
      gymAddress: 'Sector 5',
      consistencyScore: 95,
    },
  },
];

async function upsertDemoUser(demo) {
  let user = await User.findOne({ email: demo.email });
  if (!user) {
    user = await User.create({
      email: demo.email,
      password: demo.password,
      firstName: demo.firstName,
      lastName: demo.lastName,
      isOnboarded: true,
    });
  } else {
    user.isOnboarded = true;
    await user.save();
  }

  // Reset gamification state so re-running gives the same result instead of stacking XP
  const profileData = { ...demo.profile, xp: 0, level: 1 };
  await Profile.findOneAndUpdate(
    { userId: user._id },
    { $set: { userId: user._id, ...profileData } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await Streak.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        currentStreak: 0,
        longestStreak: 0,
        lastCheckInDate: null,
        totalCheckIns: 0,
        weeklyCheckIns: 0,
        monthlyCheckIns: 0,
        streakHistory: [],
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  return user;
}

/**
 * Removes matches, chats, sessions, check-ins etc. that involve any demo account.
 */
async function resetDemoActivity(userIds) {
  const matches = await Match.find({ users: { $in: userIds } }).select('_id');
  const matchIds = matches.map((m) => m._id);
  const conversations = await Conversation.find({
    $or: [{ participants: { $in: userIds } }, { matchId: { $in: matchIds } }],
  }).select('_id');
  const conversationIds = conversations.map((c) => c._id);

  await Promise.all([
    Message.deleteMany({ conversationId: { $in: conversationIds } }),
    Conversation.deleteMany({ _id: { $in: conversationIds } }),
    Session.deleteMany({ $or: [{ participants: { $in: userIds } }, { matchId: { $in: matchIds } }] }),
    BuddyRequest.deleteMany({ $or: [{ senderId: { $in: userIds } }, { receiverId: { $in: userIds } }] }),
    CheckIn.deleteMany({ userId: { $in: userIds } }),
    ChallengeParticipation.deleteMany({ userId: { $in: userIds } }),
    UserBadge.deleteMany({ userId: { $in: userIds } }),
  ]);
  await Match.deleteMany({ _id: { $in: matchIds } });
}

async function seedDemoStreak(user) {
  const today = todayUTC();
  const dates = Array.from({ length: DEMO_STREAK_DAYS }, (_, i) => addDaysUTC(today, i - (DEMO_STREAK_DAYS - 1)));

  await CheckIn.insertMany(
    dates.map((d) => ({
      userId: user._id,
      date: d,
      checkInTime: new Date(`${d}T07:30:00.000Z`),
      isVerified: true,
      xpEarned: DEMO_XP_PER_CHECKIN,
      notes: 'Seeded check-in',
    }))
  );

  await Streak.updateOne(
    { userId: user._id },
    {
      $set: {
        currentStreak: DEMO_STREAK_DAYS,
        longestStreak: DEMO_STREAK_DAYS,
        lastCheckInDate: today,
        totalCheckIns: DEMO_STREAK_DAYS,
        weeklyCheckIns: DEMO_STREAK_DAYS,
        monthlyCheckIns: DEMO_STREAK_DAYS,
      },
    }
  );

  const xp = DEMO_XP_PER_CHECKIN * DEMO_STREAK_DAYS;
  await Profile.updateOne(
    { userId: user._id },
    { $set: { xp, level: calcLevel(1, xp), consistencyScore: 60 } }
  );

  // Award whatever badges those check-ins qualify for (e.g. "First Step")
  await badgeService.checkAndAwardBadges(user._id);
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const badges = await badgeService.seedBadges();
  console.log(`Badges: ${badges.seededCount} created`);

  const challenges = await seedChallenges();
  console.log(`Challenges: ${challenges.created} created, ${challenges.refreshed} re-opened`);

  // Look up existing demo accounts first so their old activity is cleared before re-seeding
  const existing = await User.find({ email: { $in: DEMO_USERS.map((d) => d.email) } }).select('_id');
  await resetDemoActivity(existing.map((u) => u._id));

  const users = [];
  for (const demo of DEMO_USERS) {
    // eslint-disable-next-line no-await-in-loop
    users.push(await upsertDemoUser(demo));
    console.log(`Demo user: ${demo.email}`);
  }

  if (users[0]) {
    await seedDemoStreak(users[0]);
    console.log(`Seeded a ${DEMO_STREAK_DAYS}-day streak for ${DEMO_USERS[0].email}`);
  }

  console.log(`\nDemo accounts (password: ${DEMO_USERS[0].password}):`);
  DEMO_USERS.forEach((d) => console.log(`  - ${d.email}`));
  console.log('\nSeed complete.');
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
