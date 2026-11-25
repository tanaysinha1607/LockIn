const { CheckIn, ActivityLog, UserBadge, WorkoutLog, Match, User, Profile, Streak } = require('../models');
const { todayUTC, addDaysUTC, parseUTCDate } = require('../utils/date');
const { effectiveStreak } = require('../utils/streak');

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Monday (UTC) of the week containing `dateKey`.
 */
const weekStartOf = (dateKey) => {
  const dow = parseUTCDate(dateKey).getUTCDay(); // 0 = Sunday
  return addDaysUTC(dateKey, -((dow + 6) % 7));
};

/**
 * Weekly recap for one user. week = 'current' (Mon..today) or 'last' (previous Mon..Sun).
 */
const getWeeklyRecap = async (userId, { week = 'current' } = {}) => {
  const today = todayUTC();
  const thisMonday = weekStartOf(today);
  const start = week === 'last' ? addDaysUTC(thisMonday, -7) : thisMonday;
  const end = addDaysUTC(start, 6);
  const startDate = parseUTCDate(start);
  const endDate = new Date(parseUTCDate(end).getTime() + 24 * 60 * 60 * 1000); // exclusive

  const [user, profile, streak, checkIns, xpAgg, badges, workouts, matches] = await Promise.all([
    User.findById(userId).select('firstName'),
    Profile.findOne({ userId }).select('preferredWorkoutDays level xp').lean(),
    Streak.findOne({ userId }).lean(),
    CheckIn.find({ userId, date: { $gte: start, $lte: end } }).select('date isLockIn').lean(),
    ActivityLog.aggregate([
      { $match: { userId, createdAt: { $gte: startDate, $lt: endDate } } },
      { $group: { _id: null, xp: { $sum: '$xpChange' } } },
    ]),
    UserBadge.find({ userId, earnedAt: { $gte: startDate, $lt: endDate } }).populate('badgeId', 'name icon').lean(),
    WorkoutLog.find({ userId, date: { $gte: start, $lte: end } }).select('totalSets totalVolume exercises.name').lean(),
    Match.find({ users: userId, status: 'active' }).select('users').lean(),
  ]);

  const checkedDates = new Set(checkIns.map((c) => c.date));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysUTC(start, i);
    return {
      date,
      day: DAY_NAMES[parseUTCDate(date).getUTCDay()],
      checkedIn: checkedDates.has(date),
      future: date > today,
    };
  });

  // Rank among you + buddies by check-ins this week (ties share the better rank)
  const buddyIds = matches.flatMap((m) => m.users).filter((u) => String(u) !== String(userId));
  let rank = null;
  let groupSize = 1;
  if (buddyIds.length) {
    const counts = await CheckIn.aggregate([
      { $match: { userId: { $in: [userId, ...buddyIds] }, date: { $gte: start, $lte: end } } },
      { $group: { _id: '$userId', n: { $sum: 1 } } },
    ]);
    const byUser = new Map(counts.map((c) => [String(c._id), c.n]));
    const mine = byUser.get(String(userId)) || 0;
    groupSize = buddyIds.length + 1;
    rank = 1 + buddyIds.filter((b) => (byUser.get(String(b)) || 0) > mine).length;
  }

  const planned = (profile?.preferredWorkoutDays || []).length || null;
  const uniqueExercises = new Set(workouts.flatMap((w) => w.exercises.map((e) => e.name.toLowerCase())));

  return {
    week,
    start,
    end,
    name: user?.firstName || '',
    days,
    checkIns: checkIns.length,
    planned,
    lockIns: checkIns.filter((c) => c.isLockIn).length,
    xp: xpAgg[0]?.xp || 0,
    level: profile?.level || 1,
    streak: effectiveStreak(streak || {}, today).current,
    badges: badges.filter((b) => b.badgeId).map((b) => ({ name: b.badgeId.name, icon: b.badgeId.icon })),
    workouts: {
      count: workouts.length,
      sets: workouts.reduce((s, w) => s + (w.totalSets || 0), 0),
      volume: workouts.reduce((s, w) => s + (w.totalVolume || 0), 0),
      exercises: uniqueExercises.size,
    },
    buddyRank: rank ? { rank, of: groupSize } : null,
  };
};

module.exports = { getWeeklyRecap, weekStartOf };
