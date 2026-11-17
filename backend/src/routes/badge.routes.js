const express = require('express');
const auth = require('../middleware/auth.middleware');
const badgeController = require('../controllers/badge.controller');

const router = express.Router();

router.use(auth()); // All routes require authentication

router.get('/', badgeController.getBadges);
router.get('/my', badgeController.getMyBadges);
router.post('/seed', auth('admin'), badgeController.seedBadges); // Admin only - use `npm run seed` locally

module.exports = router;
