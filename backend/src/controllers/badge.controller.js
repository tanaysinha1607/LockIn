const badgeService = require('../services/badge.service');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

/**
 * GET /api/v1/badges
 */
const getBadges = asyncHandler(async (req, res) => {
  const badges = await badgeService.getBadgesState(req.user._id);

  res.status(200).json(
    ApiResponse.success('Badges status retrieved successfully', { badges })
  );
});

/**
 * GET /api/v1/badges/my
 */
const getMyBadges = asyncHandler(async (req, res) => {
  const earned = await badgeService.getMyBadges(req.user._id);

  res.status(200).json(
    ApiResponse.success('Earned badges retrieved successfully', {
      count: earned.length,
      earned,
    })
  );
});

/**
 * POST /api/v1/badges/seed
 */
const seedBadges = asyncHandler(async (req, res) => {
  const result = await badgeService.seedBadges();

  res.status(200).json(
    ApiResponse.success('System badges seeded successfully', result)
  );
});

module.exports = {
  getBadges,
  getMyBadges,
  seedBadges,
};
