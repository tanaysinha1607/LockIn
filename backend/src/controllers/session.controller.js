const sessionService = require('../services/session.service');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

/**
 * POST /api/v1/sessions
 */
const createSession = asyncHandler(async (req, res) => {
  const session = await sessionService.createSession(req.user._id, req.body);

  res.status(201).json(
    ApiResponse.success('Workout session scheduled successfully', { session })
  );
});

/**
 * PUT /api/v1/sessions/:sessionId/respond
 */
const respondToSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { status } = req.body;
  const session = await sessionService.respondToSession(req.user._id, sessionId, status);

  const message = status === 'confirmed'
    ? 'Workout session accepted! Lock in time.'
    : 'Workout session invitation declined.';

  res.status(200).json(
    ApiResponse.success(message, { session })
  );
});

/**
 * PUT /api/v1/sessions/:sessionId/cancel
 */
const cancelSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await sessionService.cancelSession(req.user._id, sessionId);

  res.status(200).json(
    ApiResponse.success('Workout session cancelled successfully', { session })
  );
});

/**
 * GET /api/v1/sessions
 */
const getUserSessions = asyncHandler(async (req, res) => {
  const sessions = await sessionService.getUserSessions(req.user._id);

  res.status(200).json(
    ApiResponse.success('Workout sessions retrieved successfully', {
      count: sessions.length,
      sessions,
    })
  );
});

module.exports = {
  createSession,
  respondToSession,
  cancelSession,
  getUserSessions,
};
