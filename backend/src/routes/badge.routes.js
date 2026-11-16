const express = require('express');
const auth = require('../middleware/auth.middleware');
const badgeController = require('../controllers/badge.controller');

const router = express.Router();

router.use(auth()); // All routes require authentication

router.get('/', badgeController.getBadges);
router.get('/my', badgeController.getMyBadges);
router.post('/seed', badgeController.seedBadges); // System seeding endpoint

module.exports = router;
