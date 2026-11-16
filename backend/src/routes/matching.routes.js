const express = require('express');
const auth = require('../middleware/auth.middleware');
const matchingController = require('../controllers/matching.controller');

const router = express.Router();

router.get('/suggestions', auth(), matchingController.getSuggestions);

module.exports = router;
