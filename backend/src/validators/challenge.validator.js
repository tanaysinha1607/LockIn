const Joi = require('joi');

const joinChallenge = {
  params: Joi.object().keys({
    challengeId: Joi.string().required().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message('"challengeId" must be a valid Mongo ObjectId');
      }
      return value;
    }),
  }),
};

module.exports = {
  joinChallenge,
};
