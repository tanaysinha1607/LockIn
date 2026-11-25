const Joi = require('joi');

const dateKey = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).messages({ 'string.pattern.base': 'date must be YYYY-MM-DD' });

const saveWorkout = {
  body: Joi.object().keys({
    date: dateKey.optional(),
    workoutType: Joi.string().max(50).allow(null, '').optional(),
    durationMin: Joi.number().integer().min(1).max(600).allow(null).optional(),
    notes: Joi.string().max(500).allow('').optional(),
    exercises: Joi.array()
      .items(
        Joi.object().keys({
          name: Joi.string().trim().min(1).max(60).required(),
          sets: Joi.array()
            .items(
              Joi.object().keys({
                reps: Joi.number().integer().min(1).max(500).required(),
                weight: Joi.number().min(0).max(1000).default(0),
              })
            )
            .min(1)
            .max(20)
            .required(),
        })
      )
      .min(1)
      .max(20)
      .required(),
  }),
};

const byDate = { params: Joi.object().keys({ date: dateKey.required() }) };

const list = {
  query: Joi.object().keys({
    before: dateKey.optional(),
    limit: Joi.number().integer().min(1).max(60).default(20),
  }),
};

const progress = {
  query: Joi.object().keys({
    exercise: Joi.string().trim().min(1).max(60).required(),
    limit: Joi.number().integer().min(2).max(60).default(20),
  }),
};

module.exports = { saveWorkout, byDate, list, progress };
