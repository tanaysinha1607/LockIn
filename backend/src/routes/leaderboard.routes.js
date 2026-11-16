const express = require('express');
const auth = require('../middleware/auth.middleware');
const leaderboardController = require('../controllers/leaderboard.controller');

const router = express.Router();

router.use(auth()); // Require authentication

router.get('/', leaderboardController.getLeaderboard);

module.exports = router;
