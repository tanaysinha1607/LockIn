const { User, Profile, Streak, CheckIn } = require('../models');
const { notify } = require('../services/notification.service');
const { NOTIFICATION_TYPES } = require('../config/constants');
const { logger } = require('../utils/logger');

/*
 * Push-only daily reminders (nothing is added to the in-app list).
 *
 * 1. Check-in reminder: on one of your workout days, at your usual start time (your local
 *    time), if you haven't checked in yet today.
 * 2. Streak alert: if you have a streak of 2+ days and haven't checked in today, before the
 *    day ends. Check-in days are UTC days (see utils/date.js), so "tonight" is whichever
 *    comes first: 20:00 your time, or 3 hours before UTC midnight.
 *
 * Each is sent at most once per UTC day per user (User.reminderLog). Users who turned off
 * "Check-in reminders" or have no phone registered for push are skipped.
 */

const REMINDER_WINDOW_MIN = 60; // check-in reminder fires during the first hour of your slot
const STREAK_LOCAL_HOUR = 20;
const STREAK_HOURS_BEFORE_UTC_MIDNIGHT = 3;
const DEFAULT_TIMEZONE = 'UTC';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const isValidTimezone = (tz) => {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/**
 * Local wall-clock time in a timezone: { weekday: 'monday', minutes: 0-1439 }.
 */
const localTime = (now, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    weekday: get('weekday').toLowerCase(),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
};

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/**
 * Pure decision logic (unit-testable). Returns which reminders are due for one user.
 */
const utcDateKey = (now) => now.toISOString().slice(0, 10); // same format as CheckIn.date

const decideReminders = ({ now, timeZone, profile, streak, checkedInToday, reminderLog = {} }) => {
  const today = utcDateKey(now);
  const due = [];
  if (checkedInToday) return due;

  const tz = isValidTimezone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
  const local = localTime(now, tz);

  // 1. Check-in reminder
  const start = toMinutes(profile?.preferredWorkoutTime?.start);
  const isWorkoutDay = (profile?.preferredWorkoutDays || []).includes(local.weekday);
  if (
    reminderLog.checkIn !== today &&
    isWorkoutDay &&
    start !== null &&
    local.minutes >= start &&
    local.minutes < start + REMINDER_WINDOW_MIN
  ) {
    due.push('checkIn');
  }

  // 2. Streak alert
  const minutesToUtcMidnight = 24 * 60 - (now.getUTCHours() * 60 + now.getUTCMinutes());
  const currentStreak = streak?.currentStreak || 0;
  // Still alive only if the last check-in was yesterday (UTC); older means it already reset
  const yesterday = utcDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const streakAlive = streak?.lastCheckInDate === yesterday && currentStreak >= 2;
  if (
    reminderLog.streak !== today &&
    streakAlive &&
    (local.minutes >= STREAK_LOCAL_HOUR * 60 || minutesToUtcMidnight <= STREAK_HOURS_BEFORE_UTC_MIDNIGHT * 60)
  ) {
    due.push('streak');
  }

  return due;
};

const MESSAGES = {
  checkIn: (name) => ({
    type: NOTIFICATION_TYPES.CHECK_IN_REMINDER,
    title: 'Time to lock in 💪',
    body: `Your usual session starts now${name ? `, ${name}` : ''}. Check in when you get to the gym.`,
  }),
  streak: (name, days) => ({
    type: NOTIFICATION_TYPES.STREAK_ALERT,
    title: `Your ${days}-day streak ends tonight 🔥`,
    body: `Get a check-in in before the day is over${name ? `, ${name}` : ''} — don't let it reset.`,
  }),
};

/**
 * One sweep over every user who can receive push. Safe to run as often as you like.
 */
const runReminderSweep = async (now = new Date()) => {
  const today = utcDateKey(now);
  let sent = 0;

  const users = User.find({
    isActive: true,
    isOnboarded: true,
    'pushTokens.0': { $exists: true },
    'notificationPreferences.checkInReminders': { $ne: false },
  })
    .select('firstName timezone reminderLog')
    .lean()
    .cursor();

  for await (const user of users) {
    try {
      const [profile, streak, checkedInToday] = await Promise.all([
        Profile.findOne({ userId: user._id }).select('preferredWorkoutDays preferredWorkoutTime').lean(),
        Streak.findOne({ userId: user._id }).select('currentStreak lastCheckInDate').lean(),
        CheckIn.exists({ userId: user._id, date: today }),
      ]);

      const due = decideReminders({
        now,
        timeZone: user.timezone,
        profile,
        streak,
        checkedInToday: Boolean(checkedInToday),
        reminderLog: user.reminderLog || {},
      });

      for (const kind of due) {
        // Claim the slot first so overlapping sweeps (or two servers) can't double-send
        const claimed = await User.updateOne(
          { _id: user._id, [`reminderLog.${kind}`]: { $ne: today } },
          { $set: { [`reminderLog.${kind}`]: today } }
        );
        if (!claimed.modifiedCount) continue;

        const msg = kind === 'checkIn' ? MESSAGES.checkIn(user.firstName) : MESSAGES.streak(user.firstName, streak.currentStreak);
        await notify({ userId: user._id, ...msg, data: {} }, { store: false });
        sent += 1;
      }
    } catch (err) {
      logger.warn(`Reminder sweep failed for user ${user._id}: ${err.message}`);
    }
  }

  if (sent) logger.info(`Reminder sweep sent ${sent} reminder(s)`);
  return { sent };
};

module.exports = { runReminderSweep, decideReminders, isValidTimezone, localTime };
