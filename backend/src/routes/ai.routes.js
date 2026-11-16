const express = require('express');
const auth = require('../middleware/auth.middleware');
const aiController = require('../controllers/ai.controller');

const router = express.Router();

router.use(auth()); // Require authentication for all AI features

router.get('/workout-plan', aiController.getWorkoutPlan);
router.get('/diet-plan', aiController.getDietPlan);
router.post('/chat', aiController.chatWithCoach);

module.exports = router;
