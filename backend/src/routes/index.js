const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const matchingRoutes = require('./matching.routes');
const buddyRequestRoutes = require('./buddyRequest.routes');
const checkInRoutes = require('./checkIn.routes');
const chatRoutes = require('./chat.routes');
const sessionRoutes = require('./session.routes');
const challengeRoutes = require('./challenge.routes');
const badgeRoutes = require('./badge.routes');
const leaderboardRoutes = require('./leaderboard.routes');
const aiRoutes = require('./ai.routes');
const notificationRoutes = require('./notification.routes');
const workoutRoutes = require('./workout.routes');
const feedRoutes = require('./feed.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/matches', matchingRoutes);
router.use('/buddy-requests', buddyRequestRoutes);
router.use('/check-ins', checkInRoutes);
router.use('/chat', chatRoutes);
router.use('/sessions', sessionRoutes);
router.use('/challenges', challengeRoutes);
router.use('/badges', badgeRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/ai', aiRoutes);
router.use('/notifications', notificationRoutes);
router.use('/workouts', workoutRoutes);
router.use('/feed', feedRoutes);

module.exports = router;
