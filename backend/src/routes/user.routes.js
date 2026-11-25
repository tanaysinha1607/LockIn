const express = require('express');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const userValidator = require('../validators/user.validator');
const userController = require('../controllers/user.controller');

const router = express.Router();

router.get('/me', auth(), userController.getMe);
router.get(
  '/me/recap',
  auth(),
  validate({ query: require('joi').object({ week: require('joi').string().valid('current', 'last').default('current') }) }),
  userController.getWeeklyRecap
);
router.put('/profile', auth(), validate(userValidator.updateProfile), userController.updateProfile);
router.put('/gym-location', auth(), validate(userValidator.updateGymLocation), userController.updateGymLocation);

module.exports = router;
