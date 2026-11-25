const { addDaysUTC, diffDaysUTC } = require('./date');

// A freeze covers one missed day. You start with 2 (Streak.streakFreezes default),
// earn one more every 7 days of streak, and can hold at most 3.
const MAX_FREEZES = 3;
const FREEZE_EARN_EVERY = 7;

/**
 * Days missed between the last check-in and today (0 if the last check-in was yesterday).
 */
const missedDays = (lastDate, today) => (lastDate ? Math.max(0, diffDaysUTC(lastDate, today) - 1) : null);

/**
 * What happens to a streak when the user checks in today.
 * @returns {{ next: number, freezesUsed: number, reset: boolean }}
 */
const resolveCheckInStreak = ({ currentStreak = 0, lastCheckInDate = null, streakFreezes = 0 }, today) => {
  if (!lastCheckInDate || currentStreak <= 0) return { next: 1, freezesUsed: 0, reset: false };
  const missed = missedDays(lastCheckInDate, today);
  if (missed === 0) return { next: currentStreak + 1, freezesUsed: 0, reset: false };
  if (missed <= streakFreezes) return { next: currentStreak + 1, freezesUsed: missed, reset: false };
  return { next: 1, freezesUsed: 0, reset: true };
};

/**
 * The streak as it stands right now, for display. The stored number is only rewritten on
 * the next check-in, so a streak that has already run past its freezes must show as 0.
 * @returns {{ current: number, frozenDays: number, atRisk: boolean }}
 *   frozenDays: missed days that freezes will cover if you check in today
 */
const effectiveStreak = ({ currentStreak = 0, lastCheckInDate = null, streakFreezes = 0 } = {}, today) => {
  if (!lastCheckInDate || currentStreak <= 0) return { current: 0, frozenDays: 0, atRisk: false };
  const missed = missedDays(lastCheckInDate, today);
  if (missed === null || lastCheckInDate === today) return { current: currentStreak, frozenDays: 0, atRisk: false };
  if (missed === 0) return { current: currentStreak, frozenDays: 0, atRisk: true };
  if (missed <= streakFreezes) return { current: currentStreak, frozenDays: missed, atRisk: true };
  return { current: 0, frozenDays: 0, atRisk: false };
};

/**
 * Freezes after reaching `nextStreak` (earn one every 7 days, capped).
 */
const freezesAfter = (freezes, freezesUsed, nextStreak) => {
  let f = Math.max(0, (freezes || 0) - freezesUsed);
  const earned = nextStreak > 0 && nextStreak % FREEZE_EARN_EVERY === 0 && f < MAX_FREEZES;
  if (earned) f += 1;
  return { freezes: f, earned };
};

module.exports = {
  MAX_FREEZES,
  FREEZE_EARN_EVERY,
  missedDays,
  resolveCheckInStreak,
  effectiveStreak,
  freezesAfter,
  addDaysUTC,
};
