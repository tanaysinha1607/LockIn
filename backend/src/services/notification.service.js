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

const deliverPush = async (user, { type, title, body, data = {} }) => {
  const tokens = user.pushTokens || [];
  const result = await sendExpoPush(tokens.map((to) => ({ to, title, body, data: { ...data, type } })));
  if (result.invalidTokens.length) {
    await User.updateOne({ _id: user._id }, { $pull: { pushTokens: { $in: result.invalidTokens } } });
  }
  logger.info(`Push "${type}" to user ${user._id}: ${result.sent}/${tokens.length} device(s) accepted by Expo`);
  return { deviceCount: tokens.length, ...result };
};

const sendPushToUser = async (userId, notification) => {
  const user = await User.findById(userId).select('+pushTokens notificationPreferences');
  if (!user) return false;
  if (!user.pushTokens?.length) {
    logger.debug(`No push sent to user ${userId}: no registered devices`);
    return false;
  }
  if (!pushAllowed(user, notification.type)) return false;
  const { sent } = await deliverPush(user, notification);
  return sent > 0;
};

/**
 * Sends a push to the caller's own devices and reports what happened. For debugging setup.
 */
const sendTestPush = async (userId) => {
  const user = await User.findById(userId).select('+pushTokens firstName');
  if (!user?.pushTokens?.length) {
    return {
      deviceCount: 0,
      sent: 0,
      errors: ['No devices registered for push on this account. Open the app on your phone and allow notifications.'],
    };
  }
  const result = await deliverPush(user, {
    type: NOTIFICATION_TYPES.MOTIVATION,
    title: 'LockIn test push 🔔',
    body: `It works, ${user.firstName || 'champ'}! Push notifications are set up.`,
  });
  return { deviceCount: result.deviceCount, sent: result.sent, errors: result.errors };
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

const registerPushToken = async (userId, token, timezone) => {
  // Remove from any other account first (shared device / account switch), then add here
  await User.updateMany({ _id: { $ne: userId }, pushTokens: token }, { $pull: { pushTokens: token } });
  await User.updateOne({ _id: userId }, { $pull: { pushTokens: token } });
  await User.updateOne(
    { _id: userId },
    { $push: { pushTokens: { $each: [token], $slice: -MAX_PUSH_TOKENS } } }
  );

  // Reminders are timed in the user's local time
  const { isValidTimezone } = require('../jobs/reminders');
  if (isValidTimezone(timezone)) {
    await User.updateOne({ _id: userId }, { $set: { timezone } });
  }
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
  sendTestPush,
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  registerPushToken,
  removePushToken,
  updatePreferences,
  pushAllowed,
};
