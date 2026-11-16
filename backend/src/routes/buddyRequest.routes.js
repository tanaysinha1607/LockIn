const express = require('express');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const buddyRequestValidator = require('../validators/buddyRequest.validator');
const buddyRequestController = require('../controllers/buddyRequest.controller');

const router = express.Router();

router.post('/', auth(), validate(buddyRequestValidator.sendRequest), buddyRequestController.sendRequest);
router.put('/:requestId', auth(), validate(buddyRequestValidator.respondToRequest), buddyRequestController.respondToRequest);
router.get('/incoming', auth(), buddyRequestController.getIncoming);
router.get('/outgoing', auth(), buddyRequestController.getOutgoing);
router.get('/active', auth(), buddyRequestController.getMatches);

module.exports = router;
