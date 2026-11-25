const { Match, CheckIn, User, Streak, ActivityLog } = require('../models');
const AppError = require('../utils/AppError');
const { NOTIFICATION_TYPES, ACTIVITY_LOG_ACTIONS } = require('../config/constants');
const { awardXp } = require('../utils/xp');
const { addDaysUTC } = require('../utils/date');
const { logger } = require('../utils/logger');

// Extra XP each buddy gets on a day you both check in
const LOCK_IN_XP = 25;
// Bonus XP for both when a shared streak hits these lengths
const LOCK_IN_STREAK_MILESTONES = { 3: 50, 7: 150, 14: 300, 30: 700 };

/**
 * A shared streak only counts while it's alive: the last mutual day must be today or
 * yesterday (UTC). Older means it has already broken, even though the stored number
 * hasn't been reset yet.
 */
const effectiveLockInStreak = (match, today) => {
  const s = match?.lockInStreak || {};
  const alive = s.lastDate === today || s.lastDate === addDaysUTC(today, -1);
  return {
    current: alive ? s.current || 0 : 0,
    longest: s.longest || 0,
    lastDate: s.lastDate || null,
    lockedInToday: s.lastDate === today,
  };
};

/**
 * Called after `userId` checks in on `today`. For every active buddy who has also checked
 * in today, records a mutual "lock-in" exactly once per pair per day: extends the shared
 * streak, bumps lockInCount, marks both check-ins, awards XP and notifies both.
 *
 * @returns {Promise<Array<{ matchId, buddyId, buddyName, streak, xp }>>} lock-ins made now
 */
const recordMutualLockIns = async (userId, today) => {
  const { notify } = require('./notification.service');
  const yesterday = addDaysUTC(today, -1);
  const matches = await Match.find({ users: userId, status: 'active' }).select('users');
  const results = [];

  for (const m of matches) {
    const buddyId = m.users.find((u) => String(u) !== String(userId));
    if (!buddyId) continue;

    const buddyCheckIn = await CheckIn.exists({ userId: buddyId, date: today });
    if (!buddyCheckIn) continue;

    // Claim today for this pair atomically. If both buddies check in at the same moment,
    // only one request wins; the other sees lastDate === today and skips.
    const updated = await Match.findOneAndUpdate(
      { _id: m._id, 'lockInStreak.lastDate': { $ne: today } },
      [
        {
          $set: {
            'lockInStreak.current': {
              $cond: [
                { $eq: ['$lockInStreak.lastDate', yesterday] },
                { $add: [{ $ifNull: ['$lockInStreak.current', 0] }, 1] },
                1,
              ],
            },
            'lockInStreak.lastDate': today,
            lockInCount: { $add: [{ $ifNull: ['$lockInCount', 0] }, 1] },
          },
        },
        {
          $set: {
            'lockInStreak.longest': {
              $max: [{ $ifNull: ['$lockInStreak.longest', 0] }, '$lockInStreak.current'],
            },
          },
        },
      ],
      { new: true }
    );
    if (!updated) continue;

    const streak = updated.lockInStreak.current;
    const xp = LOCK_IN_XP + (LOCK_IN_STREAK_MILESTONES[streak] || 0);

    await Promise.all([
      CheckIn.updateMany(
        { userId: { $in: [userId, buddyId] }, date: today },
        { $set: { isLockIn: true, lockInMatchId: m._id } }
      ),
      Streak.updateMany({ userId: { $in: [userId, buddyId] } }, { $inc: { totalLockIns: 1 } }),
      awardXp(userId, xp),
      awardXp(buddyId, xp),
    ]);

    const [me, buddy] = await Promise.all([
      User.findById(userId).select('firstName'),
      User.findById(buddyId).select('firstName'),
    ]);
    const myName = me?.firstName || 'Your buddy';
    const buddyName = buddy?.firstName || 'Your buddy';
    const streakText = streak > 1 ? `${streak}-day LockIn streak` : 'LockIn streak started';

    await Promise.all([
      notify({
        userId,
        type: NOTIFICATION_TYPES.LOCK_IN,
        title: `🔒 Locked in with ${buddyName}!`,
        body: `You both trained today — ${streakText}. +${xp} XP`,
        data: { matchId: m._id, buddyId },
      }),
      notify({
        userId: buddyId,
        type: NOTIFICATION_TYPES.LOCK_IN,
        title: `🔒 Locked in with ${myName}!`,
        body: `You both trained today — ${streakText}. +${xp} XP`,
        data: { matchId: m._id, buddyId: userId },
      }),
    ]).catch((err) => logger.warn(`Lock-in notification failed: ${err.message}`));

    ActivityLog.insertMany(
      [userId, buddyId].map((uid) => ({
        userId: uid,
        action: ACTIVITY_LOG_ACTIONS.LOCK_IN,
        xpChange: xp,
        metadata: { matchId: m._id, lockInStreak: streak, date: today },
      }))
    ).catch(() => {});

    results.push({ matchId: m._id, buddyId, buddyName, streak, xp });
  }

  return results;
};

/**
 * After `userId` checks in, push "X just checked in" to each active buddy who hasn't
 * checked in yet today. (Buddies who already have get the lock-in notification instead.)
 * Push only: nothing is added to the in-app list.
 */
const alertBuddiesOfCheckIn = async (userId, today) => {
  const { notify } = require('./notification.service');
  const [me, matches] = await Promise.all([
    User.findById(userId).select('firstName'),
    Match.find({ users: userId, status: 'active' }).select('users'),
  ]);
  const name = me?.firstName || 'Your buddy';

  await Promise.all(
    matches.map(async (m) => {
      const buddyId = m.users.find((u) => String(u) !== String(userId));
      if (!buddyId || (await CheckIn.exists({ userId: buddyId, date: today }))) return;
      await notify(
        {
          userId: buddyId,
          type: NOTIFICATION_TYPES.BUDDY_CHECK_IN,
          title: `${name} just checked in 💪`,
          body: 'Your turn — check in today to lock in together.',
          data: { matchId: m._id, buddyId: userId },
        },
        { store: false }
      );
    })
  );
};

/**
 * Nudge your buddy to get to the gym. Once per buddy per day, and only if they haven't
 * checked in yet. Goes to their in-app list and their phone.
 */
const nudgeBuddy = async (userId, matchId, today) => {
  const { notify } = require('./notification.service');
  const match = await Match.findOne({ _id: matchId, users: userId, status: 'active' });
  if (!match) throw new AppError('Buddy match not found.', 404);

  const buddyId = match.users.find((u) => String(u) !== String(userId));
  if (await CheckIn.exists({ userId: buddyId, date: today })) {
    throw new AppError('Your buddy already checked in today.', 400, 'ALREADY_CHECKED_IN');
  }

  // Claim today's nudge atomically
  const key = `lastNudgeBy.${userId}`;
  const claimed = await Match.updateOne({ _id: match._id, [key]: { $ne: today } }, { $set: { [key]: today } });
  if (!claimed.modifiedCount) {
    throw new AppError('You already nudged your buddy today.', 429, 'ALREADY_NUDGED');
  }

  const [me, iCheckedIn] = await Promise.all([
    User.findById(userId).select('firstName'),
    CheckIn.exists({ userId, date: today }),
  ]);
  const name = me?.firstName || 'Your buddy';

  await notify({
    userId: buddyId,
    type: NOTIFICATION_TYPES.BUDDY_NUDGE,
    title: iCheckedIn ? `${name} is at the gym — where are you? 👀` : `${name} nudged you 👊`,
    body: iCheckedIn
      ? 'Check in today to lock in together and keep your streak.'
      : `${name} wants you both at the gym today. Don't leave them hanging!`,
    data: { matchId: match._id, buddyId: userId },
  });

  return { nudged: true };
};

module.exports = {
  alertBuddiesOfCheckIn,
  nudgeBuddy,
  recordMutualLockIns,
  effectiveLockInStreak,
  LOCK_IN_XP,
  LOCK_IN_STREAK_MILESTONES,
};
