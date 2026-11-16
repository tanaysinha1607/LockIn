const challengeService = require('../services/challenge.service');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

/**
 * GET /api/v1/challenges
 */
const getChallenges = asyncHandler(async (req, res) => {
  const challenges = await challengeService.getChallenges(req.user._id);

  res.status(200).json(
    ApiResponse.success('Challenges retrieved successfully', { challenges })
  );
});

/**
 * POST /api/v1/challenges/:challengeId/join
 */
const joinChallenge = asyncHandler(async (req, res) => {
  const { challengeId } = req.params;
  const participation = await challengeService.joinChallenge(req.user._id, challengeId);

  res.status(201).json(
    ApiResponse.success('Successfully joined the challenge', { participation })
  );
});

/**
 * GET /api/v1/challenges/my
 */
const getMyChallenges = asyncHandler(async (req, res) => {
  const participations = await challengeService.getMyChallenges(req.user._id);

  res.status(200).json(
    ApiResponse.success('Your active challenges retrieved successfully', {
      count: participations.length,
      participations,
    })
  );
});

/**
 * GET /api/v1/challenges/:challengeId/leaderboard
 */
const getChallengeLeaderboard = asyncHandler(async (req, res) => {
  const { challengeId } = req.params;
  const leaderboard = await challengeService.getChallengeLeaderboard(challengeId);

  res.status(200).json(
    ApiResponse.success('Challenge leaderboard retrieved successfully', { leaderboard })
  );
});

/**
 * POST /api/v1/challenges/evaluate
 */
const evaluateChallenges = asyncHandler(async (req, res) => {
  const result = await challengeService.evaluateAllChallenges();

  res.status(200).json(
    ApiResponse.success('All challenges evaluated successfully', result)
  );
});

module.exports = {
  getChallenges,
  joinChallenge,
  getMyChallenges,
  getChallengeLeaderboard,
  evaluateChallenges,
};
