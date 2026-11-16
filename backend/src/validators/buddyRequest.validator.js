const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
  'string.pattern.base': 'Invalid ID format',
});

const sendRequest = {
  body: Joi.object().keys({
    receiverId: objectId,
  }),
};

const respondToRequest = {
  params: Joi.object().keys({
    requestId: objectId,
  }),
  body: Joi.object().keys({
    status: Joi.string().valid('accepted', 'rejected').required(),
  }),
};

module.exports = {
  sendRequest,
  respondToRequest,
};
