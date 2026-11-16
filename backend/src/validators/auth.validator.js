const Joi = require('joi');
const { GENDERS } = require('../config/constants');

const register = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().min(8),
    firstName: Joi.string().required().min(2).max(50),
    lastName: Joi.string().required().min(2).max(50),
    dateOfBirth: Joi.date().optional(),
    gender: Joi.string().valid(...Object.values(GENDERS)).optional(),
    phone: Joi.string().optional().allow(null, ''),
  }),
};

const login = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required(),
  }),
};

const refreshToken = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required(),
  }),
};

module.exports = {
  register,
  login,
  refreshToken,
};
