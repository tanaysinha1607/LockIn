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

module.exports = {
  getSuggestions,
};
