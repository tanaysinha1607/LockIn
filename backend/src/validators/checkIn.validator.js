const Joi = require('joi');
const { MOODS } = require('../config/constants');

const checkIn = {
  body: Joi.object()
    .keys({
      location: Joi.object()
        .keys({
          type: Joi.string().valid('Point').optional(),
          coordinates: Joi.array().items(Joi.number()).length(2).optional(),
        })
        .optional(),
      mood: Joi.string()
        .valid(...MOODS)
        .allow(null)
        .optional(),
      notes: Joi.string().max(500).allow('').optional(),
      workoutType: Joi.string().max(50).allow(null, '').optional(),
    })
    .default({}),
};

module.exports = {
  checkIn,
};
