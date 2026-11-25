const BuddyRequest = require('../models/BuddyRequest');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const Profile = require('../models/Profile');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { notify } = require('./notification.service');
const { NOTIFICATION_TYPES } = require('../config/constants');
const compatibilityService = require('./compatibility.service');

/**
 * Calculates Haversine distance in kilometers between two sets of coordinates [lon, lat]
 */
const calculateHaversineDistance = (coords1, coords2) => {
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Send a new connection request to a potential gym partner.
 */
const sendBuddyRequest = async (senderId, receiverId) => {
  if (String(senderId) === String(receiverId)) {
    throw new AppError('You cannot send a buddy request to yourself.', 400);
  }

  const receiver = await User.findById(receiverId);
  if (!receiver) {
    throw new AppError('The target gym user does not exist.', 404);
  }

  // Check if a request is already pending or if they are already buddies
  const existingRequest = await BuddyRequest.findOne({
    $or: [
      { senderId, receiverId },
      { senderId: receiverId, receiverId: senderId },
    ],
    status: 'pending',
  });

  if (existingRequest) {
    throw new AppError('A pending buddy request already exists between you.', 400);
  }

  const existingMatch = await Match.findOne({
    users: { $all: [senderId, receiverId] },
    status: 'active',
  });

  if (existingMatch) {
    throw new AppError('You are already connected as gym buddies.', 400);
  }

  const request = await BuddyRequest.create({
    senderId,
    receiverId,
    status: 'pending',
  });

  const sender = await User.findById(senderId).select('firstName');
  await notify({
    userId: receiverId,
    type: NOTIFICATION_TYPES.BUDDY_REQUEST,
    title: 'New buddy request 🤝',
    body: `${sender?.firstName || 'Someone'} wants to be your gym buddy.`,
    data: { requestId: request._id, senderId },
  }).catch(() => {});

  return request;
};

/**
 * Accept or reject an incoming buddy connection request.
 * Creates a Match and Conversation if accepted.
 */
const respondToBuddyRequest = async (receiverId, requestId, status) => {
  const request = await BuddyRequest.findById(requestId);

  if (!request) {
    throw new AppError('Buddy request not found.', 404);
  }

  if (String(request.receiverId) !== String(receiverId)) {
    throw new AppError('Unauthorized. You are not the recipient of this request.', 403);
  }

  if (request.status !== 'pending') {
    throw new AppError(`Buddy request has already been ${request.status}.`, 400);
  }

  if (status !== 'accepted' && status !== 'rejected') {
    throw new AppError('Invalid response status. Must be accepted or rejected.', 400);
  }

  request.status = status;
  request.respondedAt = new Date();
  await request.save();

  let match = null;

  if (status === 'accepted') {
    const senderId = request.senderId;

    // Load profiles to calculate final compatibility score and breakdown
    const profileA = await Profile.findOne({ userId: senderId });
    const profileB = await Profile.findOne({ userId: receiverId });

    let distanceKm = 0;
    if (profileA?.gymLocation?.coordinates && profileB?.gymLocation?.coordinates) {
      distanceKm = calculateHaversineDistance(
        profileA.gymLocation.coordinates,
        profileB.gymLocation.coordinates
      );
    }

    const compatibility = compatibilityService.calculateCompatibility(
      profileA,
      profileB,
      distanceKm
    );

    // Create Match document
    match = await Match.create({
      users: [senderId, receiverId],
      compatibilityScore: compatibility.total,
      scoreBreakdown: compatibility.breakdown,
      status: 'active',
    });

    // Create Chat Conversation document
    const conversation = await Conversation.create({
      matchId: match._id,
      participants: [senderId, receiverId],
    });

    // Link conversation back to the match
    match.conversationId = conversation._id;
    await match.save();

    request.matchId = match._id;
    await request.save();

    const receiver = await User.findById(receiverId).select('firstName');
    await notify({
      userId: senderId,
      type: NOTIFICATION_TYPES.BUDDY_ACCEPTED,
      title: 'Buddy request accepted 🔒',
      body: `${receiver?.firstName || 'Your buddy'} accepted. Say hi and plan your first session!`,
      data: {
        matchId: match._id,
        conversationId: conversation._id,
        buddyId: receiverId,
        buddyName: receiver?.firstName || 'Buddy',
      },
    }).catch(() => {});

    // Put both buddies' live sockets into the new chat room right away
    try {
      const { joinUsersToConversation } = require('../socket');
      joinUsersToConversation([senderId, receiverId], conversation._id);
    } catch (err) {
      // Socket layer not initialised (e.g. scripts) - clients join on next connect
    }
  }

  return { request, match };
};

/**
 * Fetch pending incoming buddy requests
 */
const getIncomingRequests = async (userId) => {
  const requests = await BuddyRequest.find({ receiverId: userId, status: 'pending' })
    .populate('senderId', 'firstName lastName avatar lastActive gender')
    .sort({ createdAt: -1 });

  return requests;
};

/**
 * Fetch pending outgoing buddy requests
 */
const getOutgoingRequests = async (userId) => {
  const requests = await BuddyRequest.find({ senderId: userId, status: 'pending' })
    .populate('receiverId', 'firstName lastName avatar lastActive gender')
    .sort({ createdAt: -1 });

  return requests;
};

/**
 * Get active matches with detailed profile descriptions
 */
const getActiveMatches = async (userId) => {
  const matches = await Match.find({ users: userId, status: 'active' })
    .populate({
      path: 'users',
      select: 'firstName lastName avatar lastActive gender isOnboarded',
    })
    .sort({ updatedAt: -1 });

  const { effectiveLockInStreak } = require('./lockIn.service');
  const CheckIn = require('../models/CheckIn');
  const { todayUTC } = require('../utils/date');
  const today = todayUTC();
  const iCheckedIn = Boolean(await CheckIn.exists({ userId, date: today }));

  // Map matches to load profile for the other user in the pairing
  const result = [];
  for (const m of matches) {
    const buddyUser = m.users.find((u) => String(u._id) !== String(userId));
    if (!buddyUser) continue;

    const buddyProfile = await Profile.findOne({ userId: buddyUser._id })
      .select('bio fitnessLevel fitnessGoals workoutTypes gymName gymAddress consistencyScore commitmentType');

    result.push({
      matchId: m._id,
      compatibilityScore: m.compatibilityScore,
      scoreBreakdown: m.scoreBreakdown,
      conversationId: m.conversationId,
      startedAt: m.startedAt,
      lockInCount: m.lockInCount || 0,
      lockInStreak: effectiveLockInStreak(m, today),
      today: {
        you: iCheckedIn,
        buddy: Boolean(await CheckIn.exists({ userId: buddyUser._id, date: today })),
      },
      buddy: {
        user: buddyUser,
        profile: buddyProfile || null,
      },
    });
  }

  return result;
};

module.exports = {
  sendBuddyRequest,
  respondToBuddyRequest,
  getIncomingRequests,
  getOutgoingRequests,
  getActiveMatches,
  calculateHaversineDistance,
};
