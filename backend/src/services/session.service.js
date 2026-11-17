const { Session, Match, Profile, User, Notification, ActivityLog } = require('../models');
const AppError = require('../utils/AppError');
const { notify } = require('./notification.service');
const { SESSION_STATUS, NOTIFICATION_TYPES, ACTIVITY_LOG_ACTIONS } = require('../config/constants');
const { calculateHaversineDistance } = require('./buddyRequest.service');

/**
 * Create a new workout session invite
 */
const createSession = async (creatorId, sessionBody) => {
  const { matchId, title, scheduledDate, duration, workoutType, location, notes } = sessionBody;

  // Verify match exists, is active, and contains the creator
  const match = await Match.findOne({ _id: matchId, status: 'active', users: creatorId });
  if (!match) {
    throw new AppError('Active buddy match not found or you are not a participant.', 404);
  }

  // Find buddy's ID
  const buddyId = match.users.find(id => String(id) !== String(creatorId));
  if (!buddyId) {
    throw new AppError('Buddy not found in this match.', 404);
  }

  // Create the session
  const session = await Session.create({
    matchId,
    title,
    creatorId,
    participants: [creatorId, buddyId],
    scheduledDate,
    duration: duration || 60,
    workoutType: workoutType || null,
    location: location || null,
    status: SESSION_STATUS.PENDING,
    confirmedBy: [creatorId], // Creator automatically confirms
    notes: notes || '',
  });

  // Load creator details for notification
  const creatorUser = await User.findById(creatorId);
  const creatorName = creatorUser ? creatorUser.firstName : 'Your buddy';

  const dateStr = new Date(scheduledDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Create notification for buddy
  await notify({
    userId: buddyId,
    type: NOTIFICATION_TYPES.SESSION_REMINDER,
    title: 'Workout Session Invite 🏋️',
    body: `${creatorName} invited you to "${title}" on ${dateStr}.`,
    data: {
      sessionId: session._id,
      matchId: match._id,
    },
  });

  // Log activity
  await ActivityLog.create({
    userId: creatorId,
    action: ACTIVITY_LOG_ACTIONS.SESSION_SCHEDULED,
    metadata: {
      sessionId: session._id,
      matchId,
      scheduledDate,
    },
  }).catch(() => {});

  return session;
};

/**
 * Accept or decline a workout session invite
 */
const respondToSession = async (userId, sessionId, status) => {
  const session = await Session.findOne({ _id: sessionId, status: SESSION_STATUS.PENDING });
  if (!session) {
    throw new AppError('Pending session invite not found.', 404);
  }

  // Ensure user is the invitee (not the creator)
  if (String(session.creatorId) === String(userId)) {
    throw new AppError('You cannot respond to your own session invite.', 400);
  }

  if (!session.participants.map(p => String(p)).includes(String(userId))) {
    throw new AppError('You are not a participant in this session.', 403);
  }

  const responderUser = await User.findById(userId);
  const responderName = responderUser ? responderUser.firstName : 'Your buddy';

  if (status === SESSION_STATUS.CONFIRMED) {
    session.status = SESSION_STATUS.CONFIRMED;
    if (!session.confirmedBy.includes(userId)) {
      session.confirmedBy.push(userId);
    }
    await session.save();

    // Notify creator
    await notify({
      userId: session.creatorId,
      type: NOTIFICATION_TYPES.SESSION_REMINDER,
      title: 'Workout Invite Accepted! ✅',
      body: `${responderName} accepted your invite for "${session.title}".`,
      data: { sessionId: session._id },
    });
  } else {
    session.status = SESSION_STATUS.CANCELLED;
    await session.save();

    // Notify creator
    await notify({
      userId: session.creatorId,
      type: NOTIFICATION_TYPES.SESSION_REMINDER,
      title: 'Workout Invite Declined ❌',
      body: `${responderName} declined your invite for "${session.title}".`,
      data: { sessionId: session._id },
    });
  }

  return session;
};

/**
 * Cancel a session
 */
const cancelSession = async (userId, sessionId) => {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new AppError('Session not found.', 404);
  }

  if (!session.participants.map(p => String(p)).includes(String(userId))) {
    throw new AppError('You are not a participant in this session.', 403);
  }

  if ([SESSION_STATUS.COMPLETED, SESSION_STATUS.CANCELLED, SESSION_STATUS.MISSED].includes(session.status)) {
    throw new AppError(`Cannot cancel a session that is already ${session.status}.`, 400);
  }

  session.status = SESSION_STATUS.CANCELLED;
  await session.save();

  const canceler = await User.findById(userId);
  const cancelerName = canceler ? canceler.firstName : 'Your buddy';
  const otherUserId = session.participants.find(p => String(p) !== String(userId));

  if (otherUserId) {
    await notify({
      userId: otherUserId,
      type: NOTIFICATION_TYPES.SESSION_REMINDER,
      title: 'Workout Session Cancelled 🚫',
      body: `${cancelerName} cancelled the workout session "${session.title}".`,
      data: { sessionId: session._id },
    });
  }

  return session;
};

/**
 * Get user's sessions
 */
const getUserSessions = async (userId) => {
  const sessions = await Session.find({ participants: userId })
    .populate({
      path: 'participants',
      select: 'firstName lastName avatar lastActive gender',
    })
    .sort({ scheduledDate: -1 });

  return sessions;
};

module.exports = {
  createSession,
  respondToSession,
  cancelSession,
  getUserSessions,
};
