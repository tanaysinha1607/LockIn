const express = require('express');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const chatValidator = require('../validators/chat.validator');
const chatController = require('../controllers/chat.controller');

const router = express.Router();

router.use(auth());

router.get('/conversations', chatController.getConversations);
router.get(
  '/conversations/:conversationId/messages',
  validate(chatValidator.getMessages),
  chatController.getMessages
);
router.post(
  '/conversations/:conversationId/messages',
  validate(chatValidator.sendMessage),
  chatController.sendMessage
);
router.put(
  '/conversations/:conversationId/read',
  validate(chatValidator.markAsRead),
  chatController.markAsRead
);

module.exports = router;
