const Joi = require('joi');
const AppError = require('../utils/AppError');

const validate = (schema) => (req, res, next) => {
  const validSchema = {};
  
  // Only validate keys defined in schema (body, query, params)
  const keys = Object.keys(schema);
  
  for (const key of keys) {
    if (req[key]) {
      validSchema[key] = schema[key];
    }
  }

  const object = {};
  for (const key of keys) {
    object[key] = req[key];
  }

  const { value, error } = Joi.compile(validSchema)
    .prefs({ errors: { label: 'key' }, abortEarly: false })
    .validate(object);

  if (error) {
    const errorMessage = error.details.map((details) => details.message).join(', ');
    return next(new AppError(errorMessage, 400));
  }
  
  Object.assign(req, value);
  return next();
};

module.exports = validate;
