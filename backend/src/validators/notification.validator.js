const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
  'string.pattern.base': 'Invalid notification ID',
});

const list = {
  query: Joi.object().keys({
    before: Joi.date().iso().optional(),
    limit: Joi.number().integer().min(1).max(100).default(30),
  }),
};

const markRead = {
  params: Joi.object().keys({ notificationId: objectId.required() }),
};

const pushToken = {
  body: Joi.object().keys({
    token: Joi.string()
      .pattern(/^Expo(nent)?PushToken\[.+\]$/)
      .max(200)
      .required()
      .messages({ 'string.pattern.base': 'token must be an Expo push token' }),
    timezone: Joi.string().max(64).optional(), // IANA name, e.g. "Asia/Dubai"
  }),
};

const preferences = {
  body: Joi.object()
    .keys({
      buddyRequests: Joi.boolean(),
      messages: Joi.boolean(),
      checkInReminders: Joi.boolean(),
      motivationalNudges: Joi.boolean(),
      challengeUpdates: Joi.boolean(),
      buddyActivity: Joi.boolean(),
      weeklyRecap: Joi.boolean(),
    })
    .min(1),
};

module.exports = { list, markRead, pushToken, preferences };
