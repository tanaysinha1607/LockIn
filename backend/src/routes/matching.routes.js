const express = require('express');
const auth = require('../middleware/auth.middleware');
const Joi = require('joi');
const validate = require('../middleware/validate.middleware');
const matchingController = require('../controllers/matching.controller');

const router = express.Router();

router.get('/suggestions', auth(), matchingController.getSuggestions);
router.post(
  '/:matchId/nudge',
  auth(),
  validate({ params: Joi.object({ matchId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required() }) }),
  matchingController.nudge
);

module.exports = router;
