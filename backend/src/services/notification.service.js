const { Notification, User } = require('../models');
const AppError = require('../utils/AppError');
const { logger } = require('../utils/logger');
const { NOTIFICATION_TYPES } = require('../config/constants');
const { sendExpoPush } = require('../utils/expoPush');

// Which User.notificationPreferences switch controls push for each type.
// Types not listed (lock-ins, badges, sessions) always push.
const PREFERENCE_FOR_TYPE = {
  [NOTIFICATION_TYPES.BUDDY_REQUEST]: 'buddyRequests',
  [NOTIFICATION_TYPES.BUDDY_ACCEPTED]: 'buddyRequests',
  [NOTIFICATION_TYPES.MESSAGE]: 'messages',
  [NOTIFICATION_TYPES.CHECK_IN_REMINDER]: 'checkInReminders',
  [NOTIFICATION_TYPES.STREAK_ALERT]: 'checkInReminders',
  [NOTIFICATION_TYPES.MOTIVATION]: 'motivationalNudges',
  [NOTIFICATION_TYPES.CHALLENGE_UPDATE]: 'challengeUpdates',
};

const MAX_PUSH_TOKENS = 5;

const pushAllowed = (user, type) => {
  const pref = PREFERENCE_FOR_TYPE[type];
  return !pref || user?.notificationPreferences?.[pref] !== false;
};

const emitToUser = (userId, event, payload) => {
  try {
    const { getIO } = require('../socket');
    getIO().to(`user:${userId}`).emit(event, payload);
  } catch {
    // Socket server not running (scripts) - the app picks it up on next fetch
  }
};

const sendPushToUser = async (userId, { type, title, body, data }) => {
  const user = await User.findById(userId).select('+pushTokens notificationPreferences');
  if (!user || !user.pushTokens?.length || !pushAllowed(user, type)) return false;

  const { sent, invalidTokens } = await sendExpoPush(
    user.pushTokens.map((to) => ({ to, title, body, data: { ...data, type } }))
  );
  if (invalidTokens.length) {
    await User.updateOne({ _id: userId }, { $pull: { pushTokens: { $in: invalidTokens } } });
  }
  return sent > 0;
};

/**
 * Create an in-app notification, deliver it live to the user's open app, and push it to
 * their phone. Same argument shape as Notification.create.
 *
 * @param {{ userId, type, title, body, data? }} notification
 * @param {{ store?: boolean }} options store:false = push only (e.g. chat messages,
 *        which already have unread badges in the chat list)
 */
const notify = async ({ userId, type, title, body, data = {} }, { store = true } = {}) => {
  let doc = null;
  if (store) {
    doc = await Notification.create({ userId, type, title, body, data });
    emitToUser(userId, 'notification:new', doc);
  }

  // Fire-and-forget: push latency or failure must not slow or fail the API call
  sendPushToUser(userId, { type, title, body, data })
    .then((pushed) => {
      if (pushed && doc) return Notification.updateOne({ _id: doc._id }, { isPushed: true });
      return null;
    })
    .catch((err) => logger.warn(`Push for ${userId} failed: ${err.message}`));

  return doc;
};

const listNotifications = async (userId, { before, limit = 30 } = {}) => {
  const query = { userId };
  if (before) query.createdAt = { $lt: new Date(before) };
  return Notification.find(query).sort({ createdAt: -1 }).limit(Number(limit));
};

const getUnreadCount = (userId) => Notification.countDocuments({ userId, isRead: false });

const markRead = async (userId, notificationId) => {
  const doc = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { isRead: true } },
    { new: true }
  );
  if (!doc) throw new AppError('Notification not found.', 404);
  return doc;
};

const markAllRead = async (userId) => {
  const res = await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
  return { updated: res.modifiedCount };
};

const registerPushToken = async (userId, token) => {
  // Remove from any other account first (shared device / account switch), then add here
  await User.updateMany({ _id: { $ne: userId }, pushTokens: token }, { $pull: { pushTokens: token } });
  await User.updateOne({ _id: userId }, { $pull: { pushTokens: token } });
  await User.updateOne(
    { _id: userId },
    { $push: { pushTokens: { $each: [token], $slice: -MAX_PUSH_TOKENS } } }
  );
};

const removePushToken = (userId, token) => User.updateOne({ _id: userId }, { $pull: { pushTokens: token } });

const updatePreferences = async (userId, prefs) => {
  const set = {};
  Object.entries(prefs).forEach(([k, v]) => {
    set[`notificationPreferences.${k}`] = v;
  });
  const user = await User.findByIdAndUpdate(userId, { $set: set }, { new: true });
  return user.notificationPreferences;
};

module.exports = {
  notify,
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  registerPushToken,
  removePushToken,
  updatePreferences,
  pushAllowed,
};
