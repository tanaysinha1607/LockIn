const express = require('express');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const aiValidator = require('../validators/ai.validator');
const aiController = require('../controllers/ai.controller');
const { aiLimiter } = require('../middleware/rateLimit.middleware');

const router = express.Router();

router.use(auth()); // Require authentication for all AI features
router.use(aiLimiter); // Per-user cap on OpenAI-backed calls

router.get('/workout-plan', aiController.getWorkoutPlan);
router.get('/diet-plan', aiController.getDietPlan);
router.post('/chat', validate(aiValidator.chat), aiController.chatWithCoach);

module.exports = router;
