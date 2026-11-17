const express = require('express');
const validate = require('../middleware/validate.middleware');
const authValidator = require('../validators/auth.validator');
const authController = require('../controllers/auth.controller');
const { loginLimiter, registerLimiter, tokenLimiter } = require('../middleware/rateLimit.middleware');

const router = express.Router();

router.post('/register', registerLimiter, validate(authValidator.register), authController.register);
router.post('/login', loginLimiter, validate(authValidator.login), authController.login);
router.post('/refresh-token', tokenLimiter, validate(authValidator.refreshToken), authController.refreshToken);
router.post('/logout', tokenLimiter, validate(authValidator.refreshToken), authController.logout);

module.exports = router;
