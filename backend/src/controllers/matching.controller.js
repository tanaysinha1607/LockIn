const matchingService = require('../services/matching.service');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

/**
 * Get buddy match suggestions for the current user
 * GET /api/v1/matches/suggestions
 */
const getSuggestions = asyncHandler(async (req, res) => {
  const suggestions = await matchingService.getMatchSuggestions(req.user._id);

  res.status(200).json(
    ApiResponse.success('Match suggestions retrieved successfully', {
      count: suggestions.length,
      suggestions,
    })
  );
});

/**
 * Nudge your buddy (once per day)
 * POST /api/v1/matches/:matchId/nudge
 */
const nudge = asyncHandler(async (req, res) => {
  const { nudgeBuddy } = require('../services/lockIn.service');
  const { todayUTC } = require('../utils/date');
  const result = await nudgeBuddy(req.user._id, req.params.matchId, todayUTC());
  res.status(200).json(ApiResponse.success('Nudge sent', result));
});

module.exports = {
  nudge,
  getSuggestions,
};
