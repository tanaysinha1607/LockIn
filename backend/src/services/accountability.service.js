const CheckIn = require('../models/CheckIn');
const Streak = require('../models/Streak');
const Profile = require('../models/Profile');
const { todayUTC, addDaysUTC } = require('../utils/date');
const { effectiveStreak } = require('../utils/streak');

const clampPct = (n) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Returns streak + attendance metrics for Home and other screens.
 * This is read-only and safe to call from `GET /users/me`.
 */
const getAccountabilitySummary = async (userId, dateStr = todayUTC()) => {
  const [profile, streak] = await Promise.all([
    Profile.findOne({ userId }).select('xp level consistencyScore'),
    Streak.findOne({ userId }),
  ]);

  const today = dateStr;
  const start7 = addDaysUTC(today, -6);
  const start30 = addDaysUTC(today, -29);

  const [todayCheckIn, weeklyCount, monthlyCount] = await Promise.all([
    CheckIn.findOne({ userId, date: today }).select('_id xpEarned date checkInTime'),
    CheckIn.countDocuments({ userId, date: { $gte: start7, $lte: today } }),
    CheckIn.countDocuments({ userId, date: { $gte: start30, $lte: today } }),
  ]);

  const weeklyAttendancePct = clampPct((weeklyCount / 7) * 100);
  const monthlyAttendancePct = clampPct((monthlyCount / 30) * 100);
  const computedConsistencyScore = clampPct(monthlyAttendancePct * 0.7 + weeklyAttendancePct * 0.3);

  return {
    today,
    todayCheckedIn: Boolean(todayCheckIn),
    todayCheckIn: todayCheckIn || null,
    streak: streak
      ? {
          // Shown streak: 0 once missed days exceed freezes (stored value updates on next check-in)
          currentStreak: effectiveStreak(streak, today).current,
          frozenDays: effectiveStreak(streak, today).frozenDays,
          streakFreezes: streak.streakFreezes ?? 0,
          longestStreak: streak.longestStreak,
          lastCheckInDate: streak.lastCheckInDate,
          totalCheckIns: streak.totalCheckIns,
        }
      : null,
    metrics: {
      weeklyCheckIns: weeklyCount,
      monthlyCheckIns: monthlyCount,
      weeklyAttendancePct,
      monthlyAttendancePct,
      consistencyScore: profile?.consistencyScore ?? computedConsistencyScore,
      computedConsistencyScore,
    },
    xp: profile
      ? {
          xp: profile.xp,
          level: profile.level,
        }
      : null,
  };
};

module.exports = {
  getAccountabilitySummary,
};
