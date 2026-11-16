const buddyRequestService = require('../services/buddyRequest.service');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

/**
 * Send a buddy connection request
 * POST /api/v1/buddy-requests
 */
const sendRequest = asyncHandler(async (req, res) => {
  const { receiverId } = req.body;
  const request = await buddyRequestService.sendBuddyRequest(req.user._id, receiverId);

  res.status(201).json(
    ApiResponse.success('Buddy request sent successfully', { request })
  );
});

/**
 * Accept or reject a buddy request
 * PUT /api/v1/buddy-requests/:requestId
 */
const respondToRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { status } = req.body;
  const result = await buddyRequestService.respondToBuddyRequest(req.user._id, requestId, status);

  const message = status === 'accepted'
    ? 'Buddy request accepted! You are now gym partners.'
    : 'Buddy request rejected.';

  res.status(200).json(
    ApiResponse.success(message, {
      request: result.request,
      match: result.match || undefined,
    })
  );
});

/**
 * Get incoming pending buddy requests
 * GET /api/v1/buddy-requests/incoming
 */
const getIncoming = asyncHandler(async (req, res) => {
  const requests = await buddyRequestService.getIncomingRequests(req.user._id);

  res.status(200).json(
    ApiResponse.success('Incoming requests retrieved', {
      count: requests.length,
      requests,
    })
  );
});

/**
 * Get outgoing pending buddy requests
 * GET /api/v1/buddy-requests/outgoing
 */
const getOutgoing = asyncHandler(async (req, res) => {
  const requests = await buddyRequestService.getOutgoingRequests(req.user._id);

  res.status(200).json(
    ApiResponse.success('Outgoing requests retrieved', {
      count: requests.length,
      requests,
    })
  );
});

/**
 * Get active buddy matches
 * GET /api/v1/buddy-requests/active
 */
const getMatches = asyncHandler(async (req, res) => {
  const matches = await buddyRequestService.getActiveMatches(req.user._id);

  res.status(200).json(
    ApiResponse.success('Active matches retrieved', {
      count: matches.length,
      matches,
    })
  );
});

module.exports = {
  sendRequest,
  respondToRequest,
  getIncoming,
  getOutgoing,
  getMatches,
};
