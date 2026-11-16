const express = require('express');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const sessionValidator = require('../validators/session.validator');
const sessionController = require('../controllers/session.controller');

const router = express.Router();

router.use(auth()); // Require authentication for all session routes

router.post('/', validate(sessionValidator.createSession), sessionController.createSession);
router.get('/', sessionController.getUserSessions);
router.put('/:sessionId/respond', validate(sessionValidator.respondSession), sessionController.respondToSession);
router.put('/:sessionId/cancel', sessionController.cancelSession);

module.exports = router;
