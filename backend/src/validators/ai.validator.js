const Joi = require('joi');

const chat = {
  body: Joi.object().keys({
    message: Joi.string().trim().min(1).max(1000).required(),
    // The service only forwards the last 6 turns to OpenAI; cap what we accept.
    history: Joi.array()
      .items(
        Joi.object()
          .keys({
            sender: Joi.string().max(20).required(),
            text: Joi.string().allow('').max(2000).required(),
          })
          .unknown(true)
      )
      .max(100)
      .default([]),
  }),
};

module.exports = {
  chat,
};
