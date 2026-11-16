const Joi = require('joi');
const { SESSION_STATUS, WORKOUT_TYPES } = require('../config/constants');

const createSession = {
  body: Joi.object().keys({
    matchId: Joi.string().required().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message('"matchId" must be a valid Mongo ObjectId');
      }
      return value;
    }),
    title: Joi.string().required().trim().min(3).max(100),
    scheduledDate: Joi.date().iso().required(),
    duration: Joi.number().integer().min(10).max(480).default(60),
    workoutType: Joi.string().valid(...Object.values(WORKOUT_TYPES)).allow(null, '').optional(),
    location: Joi.string().max(200).allow(null, '').optional(),
    notes: Joi.string().max(500).allow('').optional(),
  }),
};

const respondSession = {
  body: Joi.object().keys({
    status: Joi.string().valid(SESSION_STATUS.CONFIRMED, SESSION_STATUS.CANCELLED).required(),
  }),
};

module.exports = {
  createSession,
  respondSession,
};
