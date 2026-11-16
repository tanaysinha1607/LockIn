const { User, Match } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

/**
 * GET /api/v1/leaderboard
 */
const getLeaderboard = asyncHandler(async (req, res) => {
  const myUserId = req.user._id;
  const filter = req.query.filter || 'global';
  const sortBy = req.query.sortBy || 'xp';

  let userIds = null;

  if (filter === 'buddy') {
    // Get user and their active buddy IDs
    const activeMatches = await Match.find({ users: myUserId, status: 'active' });
    const buddyIds = activeMatches.flatMap(m => m.users.filter(id => String(id) !== String(myUserId)));
    userIds = [myUserId, ...buddyIds];
  }

  // Build match stage
  const matchStage = userIds 
    ? { _id: { $in: userIds } } 
    : { isOnboarded: true }; // Only show onboarded users globally

  // Perform aggregation
  const leaderboard = await User.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'profiles',
        localField: '_id',
        foreignField: 'userId',
        as: 'profile',
      },
    },
    { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'streaks',
        localField: '_id',
        foreignField: 'userId',
        as: 'streak',
      },
    },
    { $unwind: { path: '$streak', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        firstName: 1,
        lastName: 1,
        avatar: 1,
        gender: 1,
        xp: { $ifNull: ['$profile.xp', 0] },
        level: { $ifNull: ['$profile.level', 1] },
        streak: { $ifNull: ['$streak.currentStreak', 0] },
      },
    },
    {
      $sort: sortBy === 'streak' 
        ? { streak: -1, xp: -1 } 
        : { xp: -1, streak: -1 },
    },
    { $limit: 100 },
  ]);

  res.status(200).json(
    ApiResponse.success('Leaderboard retrieved successfully', { leaderboard })
  );
});

module.exports = {
  getLeaderboard,
};
