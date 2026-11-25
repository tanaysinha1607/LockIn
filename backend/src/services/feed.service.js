const { ActivityLog, Match, User } = require('../models');
const AppError = require('../utils/AppError');
const { ACTIVITY_LOG_ACTIONS, NOTIFICATION_TYPES } = require('../config/constants');

const REACTIONS = ['🔥', '💪', '👏', '🔒', '😤'];

// What shows in the feed. Joining a challenge, messages, profile edits etc. stay private.
const FEED_ACTIONS = [
  ACTIVITY_LOG_ACTIONS.CHECK_IN,
  ACTIVITY_LOG_ACTIONS.LOCK_IN,
  ACTIVITY_LOG_ACTIONS.BADGE_EARNED,
  ACTIVITY_LOG_ACTIONS.CHALLENGE_COMPLETED,
  ACTIVITY_LOG_ACTIONS.WORKOUT_LOGGED,
];

/**
 * You + everyone you're actively matched with.
 */
const circleOf = async (userId) => {
  const matches = await Match.find({ users: userId, status: 'active' }).select('users').lean();
  const ids = new Map([[String(userId), userId]]);
  matches.forEach((m) => m.users.forEach((u) => ids.set(String(u), u)));
  return [...ids.values()];
};

const summarizeReactions = (reactions = [], userId) => {
  const counts = {};
  let mine = null;
  reactions.forEach((r) => {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    if (String(r.userId) === String(userId)) mine = r.emoji;
  });
  return { counts, mine };
};

/**
 * Feed for you and your buddies, newest first. Lock-ins are logged once per buddy, so the
 * pair's second copy is dropped.
 */
const getFeed = async (userId, { before, limit = 30 } = {}) => {
  const circle = await circleOf(userId);
  const query = { userId: { $in: circle }, action: { $in: FEED_ACTIONS } };
  if (before) query.createdAt = { $lt: new Date(before) };

  // Over-fetch a little so de-duplicated lock-ins don't leave short pages
  const logs = await ActivityLog.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit) + 10)
    .populate('userId', 'firstName lastName avatar')
    .lean();

  const buddyIds = logs.map((l) => l.metadata?.buddyId).filter(Boolean);
  const buddyNames = new Map(
    (await User.find({ _id: { $in: buddyIds } }).select('firstName').lean()).map((u) => [String(u._id), u.firstName])
  );

  const seenLockIns = new Set();
  const items = [];
  for (const log of logs) {
    if (!log.userId) continue; // deleted user
    if (log.action === ACTIVITY_LOG_ACTIONS.LOCK_IN) {
      const key = `${log.metadata?.matchId}:${log.metadata?.date}`;
      if (seenLockIns.has(key)) continue;
      seenLockIns.add(key);
    }
    const { counts, mine } = summarizeReactions(log.reactions, userId);
    items.push({
      _id: log._id,
      action: log.action,
      createdAt: log.createdAt,
      xp: log.xpChange || 0,
      isMine: String(log.userId._id) === String(userId),
      actor: { _id: log.userId._id, firstName: log.userId.firstName, lastName: log.userId.lastName },
      buddyName: log.metadata?.buddyId ? buddyNames.get(String(log.metadata.buddyId)) || null : null,
      buddyIsMe: Boolean(log.metadata?.buddyId) && String(log.metadata.buddyId) === String(userId),
      metadata: log.metadata || {},
      reactions: counts,
      myReaction: mine,
    });
    if (items.length >= Number(limit)) break;
  }

  return { items, hasMore: logs.length > items.length || logs.length >= Number(limit) + 10 };
};

/**
 * Set, change or remove (emoji = null) your reaction to a feed item in your circle.
 */
const react = async (userId, activityId, emoji) => {
  if (emoji !== null && !REACTIONS.includes(emoji)) throw new AppError('Unsupported reaction.', 400);

  const log = await ActivityLog.findOne({ _id: activityId, action: { $in: FEED_ACTIONS } });
  if (!log) throw new AppError('Feed item not found.', 404);

  const circle = (await circleOf(userId)).map(String);
  if (!circle.includes(String(log.userId))) throw new AppError('You can only react to your buddies.', 403);

  const previous = log.reactions.find((r) => String(r.userId) === String(userId))?.emoji || null;

  await ActivityLog.updateOne({ _id: log._id }, { $pull: { reactions: { userId } } });
  if (emoji) await ActivityLog.updateOne({ _id: log._id }, { $push: { reactions: { userId, emoji } } });

  // Tell the owner about a new reaction from someone else (push only)
  if (emoji && !previous && String(log.userId) !== String(userId)) {
    const { notify } = require('./notification.service');
    const me = await User.findById(userId).select('firstName').lean();
    notify(
      {
        userId: log.userId,
        type: NOTIFICATION_TYPES.FEED_REACTION,
        title: `${me?.firstName || 'A buddy'} reacted ${emoji}`,
        body: 'to your activity in the LockIn feed.',
        data: { activityId: log._id },
      },
      { store: false }
    ).catch(() => {});
  }

  const updated = await ActivityLog.findById(log._id).select('reactions').lean();
  return summarizeReactions(updated.reactions, userId);
};

module.exports = { getFeed, react, REACTIONS, FEED_ACTIONS };
