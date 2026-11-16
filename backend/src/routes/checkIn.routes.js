const express = require('express');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const checkInValidator = require('../validators/checkIn.validator');
const checkInController = require('../controllers/checkIn.controller');

const router = express.Router();

router.post('/', auth(), validate(checkInValidator.checkIn), checkInController.createCheckIn);

module.exports = router;
