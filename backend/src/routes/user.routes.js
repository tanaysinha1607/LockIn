const express = require('express');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const userValidator = require('../validators/user.validator');
const userController = require('../controllers/user.controller');

const router = express.Router();

router.get('/me', auth(), userController.getMe);
router.put('/profile', auth(), validate(userValidator.updateProfile), userController.updateProfile);

module.exports = router;
