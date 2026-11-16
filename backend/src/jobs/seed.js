/**
 * Seeds demo users with profiles at nearby coordinates for local MVP testing.
 * Usage: npm run seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Streak = require('../models/Streak');
const CheckIn = require('../models/CheckIn');
const BuddyRequest = require('../models/BuddyRequest');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const { todayUTC, addDaysUTC } = require('../utils/date');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lockin';

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
    await Streak.create({ userId: user._id });
  } else {
    user.isOnboarded = true;
    await user.save();
  }

  let profile = await Profile.findOne({ userId: user._id });
  if (profile) {
    Object.assign(profile, demo.profile);
    await profile.save();
  } else {
    profile = await Profile.create({ userId: user._id, ...demo.profile });
  }

  return user;
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  await BuddyRequest.deleteMany({});
  await Conversation.deleteMany({});
  await Match.deleteMany({});
  await CheckIn.deleteMany({});

  const users = [];
  for (const demo of DEMO_USERS) {
    const user = await upsertDemoUser(demo);
    users.push(user);
    console.log(`Seeded: ${demo.email}`);
  }

  // Seed check-ins for the first demo user (to demonstrate streak + metrics on Home)
  const demoUser = users[0];
  if (demoUser) {
    const profile = await Profile.findOne({ userId: demoUser._id });
    const streak = await Streak.findOne({ userId: demoUser._id });
    const today = todayUTC();
    const dates = [addDaysUTC(today, -4), addDaysUTC(today, -3), addDaysUTC(today, -2), addDaysUTC(today, -1), today];

    for (const d of dates) {
      // Unique index prevents dupes; ignore if already exists
      // eslint-disable-next-line no-await-in-loop
      await CheckIn.create({
        userId: demoUser._id,
        date: d,
        checkInTime: new Date(),
        isVerified: true,
        xpEarned: 150,
        notes: 'Seeded check-in',
      }).catch(() => {});
    }

    if (streak) {
      streak.currentStreak = 5;
      streak.longestStreak = Math.max(streak.longestStreak || 0, 5);
      streak.lastCheckInDate = today;
      streak.totalCheckIns = (streak.totalCheckIns || 0) + 5;
      streak.weeklyCheckIns = 5;
      streak.monthlyCheckIns = 5;
      await streak.save();
    }

    if (profile) {
      profile.xp = (profile.xp || 0) + 150 * 5;
      // keep simple level progression consistent with client (level * 1000)
      while (profile.xp >= (profile.level || 1) * 1000) {
        profile.level = (profile.level || 1) + 1;
      }
      profile.consistencyScore = 60;
      await profile.save();
    }
  }

  console.log('\nDemo accounts (password: password123):');
  DEMO_USERS.forEach((d) => console.log(`  - ${d.email}`));
  console.log('\nSeed complete.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
