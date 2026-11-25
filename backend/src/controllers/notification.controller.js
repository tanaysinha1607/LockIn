const notificationService = require('../services/notification.service');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

/** GET /api/v1/notifications?before=<iso>&limit=30 */
const list = asyncHandler(async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    notificationService.listNotifications(req.user._id, req.query),
    notificationService.getUnreadCount(req.user._id),
  ]);
  res.status(200).json(ApiResponse.success('Notifications retrieved', { notifications, unreadCount }));
});

/** GET /api/v1/notifications/unread-count */
const unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user._id);
  res.status(200).json(ApiResponse.success('Unread count retrieved', { unreadCount: count }));
});

/** PUT /api/v1/notifications/:notificationId/read */
const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markRead(req.user._id, req.params.notificationId);
  res.status(200).json(ApiResponse.success('Notification marked as read', { notification }));
});

/** PUT /api/v1/notifications/read-all */
const markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllRead(req.user._id);
  res.status(200).json(ApiResponse.success('All notifications marked as read', result));
});

/** POST /api/v1/notifications/push-token { token } */
const registerPushToken = asyncHandler(async (req, res) => {
  await notificationService.registerPushToken(req.user._id, req.body.token, req.body.timezone);
  res.status(200).json(ApiResponse.success('Push token registered'));
});

/** DELETE /api/v1/notifications/push-token { token } */
const removePushToken = asyncHandler(async (req, res) => {
  await notificationService.removePushToken(req.user._id, req.body.token);
  res.status(200).json(ApiResponse.success('Push token removed'));
});

/** PUT /api/v1/notifications/preferences { messages: false, ... } */
const updatePreferences = asyncHandler(async (req, res) => {
  const preferences = await notificationService.updatePreferences(req.user._id, req.body);
  res.status(200).json(ApiResponse.success('Notification preferences updated', { preferences }));
});

/** POST /api/v1/notifications/test-push - push to your own devices and report the result */
const testPush = asyncHandler(async (req, res) => {
  const result = await notificationService.sendTestPush(req.user._id);
  res.status(200).json(ApiResponse.success('Test push attempted', result));
});

module.exports = {
  testPush, list, unreadCount, markRead, markAllRead, registerPushToken, removePushToken, updatePreferences };
