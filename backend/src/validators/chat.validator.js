const Joi = require('joi');
const { MESSAGE_TYPES } = require('../config/constants');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
  'string.pattern.base': 'Invalid conversation ID format',
});

const sendMessage = {
  params: Joi.object().keys({
    conversationId: objectId,
  }),
  body: Joi.object().keys({
    content: Joi.string().trim().min(1).max(2000).required(),
    type: Joi.string()
      .valid(...Object.values(MESSAGE_TYPES))
      .default(MESSAGE_TYPES.TEXT),
  }),
};

const getMessages = {
  params: Joi.object().keys({
    conversationId: objectId,
  }),
  query: Joi.object().keys({
    before: Joi.date().iso().optional(),
    limit: Joi.number().integer().min(1).max(100).default(50),
  }),
};

const markAsRead = {
  params: Joi.object().keys({
    conversationId: objectId,
  }),
};

module.exports = {
  sendMessage,
  getMessages,
  markAsRead,
};
