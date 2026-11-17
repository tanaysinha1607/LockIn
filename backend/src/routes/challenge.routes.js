const express = require('express');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const challengeValidator = require('../validators/challenge.validator');
const challengeController = require('../controllers/challenge.controller');

const router = express.Router();

router.use(auth()); // Require authentication for challenges

router.get('/', challengeController.getChallenges);
router.get('/my', challengeController.getMyChallenges);
router.post('/:challengeId/join', validate(challengeValidator.joinChallenge), challengeController.joinChallenge);
router.get('/:challengeId/leaderboard', validate(challengeValidator.joinChallenge), challengeController.getChallengeLeaderboard);
router.post('/evaluate', auth('admin'), challengeController.evaluateChallenges); // Admin only - also runs hourly from server.js

module.exports = router;
