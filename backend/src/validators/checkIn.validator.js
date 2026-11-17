const Joi = require('joi');
const { MOODS } = require('../config/constants');

const checkIn = {
  body: Joi.object()
    .keys({
      location: Joi.object()
        .keys({
          type: Joi.string().valid('Point').optional(),
          coordinates: Joi.array()
            .ordered(Joi.number().min(-180).max(180).required(), Joi.number().min(-90).max(90).required())
            .length(2)
            .required()
            .description('[longitude, latitude]'),
          accuracy: Joi.number().min(0).max(100000).allow(null).optional().description('metres'),
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
