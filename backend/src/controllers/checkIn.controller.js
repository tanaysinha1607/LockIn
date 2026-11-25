const checkInService = require('../services/checkIn.service');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

/**
 * POST /api/v1/check-ins
 */
const createCheckIn = asyncHandler(async (req, res) => {
  const result = await checkInService.createDailyCheckIn(req.user._id, req.body);

  res.status(201).json(
    ApiResponse.success('Check-in created successfully', {
      checkIn: result.checkIn,
      streak: {
        currentStreak: result.streak.currentStreak,
        longestStreak: result.streak.longestStreak,
        lastCheckInDate: result.streak.lastCheckInDate,
        totalCheckIns: result.streak.totalCheckIns,
      },
      profile: {
        xp: result.profile.xp,
        level: result.profile.level,
        consistencyScore: result.profile.consistencyScore,
      },
      summary: result.summary,
      // Buddies you locked in with by this check-in: [{ buddyName, streak, xp, ... }]
      lockIns: result.lockIns || [],
      // Streak freezes: { used, earned, left }
      freezes: result.freezes,
    })
  );
});

module.exports = {
  createCheckIn,
};
