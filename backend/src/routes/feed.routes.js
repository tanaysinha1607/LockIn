const express = require('express');
const Joi = require('joi');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');
const feedService = require('../services/feed.service');

const router = express.Router();
router.use(auth());

/** GET /api/v1/feed?before=<iso>&limit=30 - you + your buddies, newest first */
router.get(
  '/',
  validate({
    query: Joi.object({
      before: Joi.date().iso().optional(),
      limit: Joi.number().integer().min(1).max(50).default(30),
    }),
  }),
  asyncHandler(async (req, res) => {
    const feed = await feedService.getFeed(req.user._id, req.query);
    res.status(200).json(ApiResponse.success('Feed retrieved', { ...feed, reactions: feedService.REACTIONS }));
  })
);

/** PUT /api/v1/feed/:activityId/reaction { emoji } - emoji null removes your reaction */
router.put(
  '/:activityId/reaction',
  validate({
    params: Joi.object({ activityId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required() }),
    body: Joi.object({ emoji: Joi.string().max(8).allow(null).required() }),
  }),
  asyncHandler(async (req, res) => {
    const result = await feedService.react(req.user._id, req.params.activityId, req.body.emoji);
    res.status(200).json(ApiResponse.success('Reaction saved', result));
  })
);

module.exports = router;
