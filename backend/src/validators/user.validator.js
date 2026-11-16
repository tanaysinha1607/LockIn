const Joi = require('joi');
const { 
  FITNESS_LEVELS, 
  COMMITMENT_TYPES,
  FITNESS_GOALS, 
  WORKOUT_TYPES, 
  DIET_TYPES, 
  BUDDY_GENDER_PREFS, 
  BUDDY_LEVEL_RANGES,
  SLEEP_PATTERNS,
  DAYS_OF_WEEK
} = require('../config/constants');

const updateProfile = {
  body: Joi.object().keys({
    bio: Joi.string().max(300).allow(''),
    fitnessLevel: Joi.string().valid(...Object.values(FITNESS_LEVELS)).required(),
    commitmentType: Joi.string().valid(...Object.values(COMMITMENT_TYPES)).default(COMMITMENT_TYPES.REGULAR),
    fitnessGoals: Joi.array().items(Joi.string().valid(...Object.values(FITNESS_GOALS))).min(1).required(),
    workoutTypes: Joi.array().items(Joi.string().valid(...Object.values(WORKOUT_TYPES))).min(1).required(),
    preferredWorkoutDays: Joi.array().items(Joi.string().valid(...DAYS_OF_WEEK)).min(1).required(),
    preferredWorkoutTime: Joi.object().keys({
      start: Joi.string().regex(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/).required().description('HH:mm format'),
      end: Joi.string().regex(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/).required().description('HH:mm format')
    }).required(),
    workoutDuration: Joi.number().min(15).max(360).default(60),
    gymLocation: Joi.object().keys({
      coordinates: Joi.array().items(Joi.number().min(-180).max(180)).length(2).required().description('[longitude, latitude]'),
    }).required(),
    gymName: Joi.string().allow(''),
    gymAddress: Joi.string().allow(''),
    height: Joi.number().min(50).max(300).allow(null),
    weight: Joi.number().min(10).max(500).allow(null),
    dietType: Joi.string().valid(...Object.values(DIET_TYPES)).default(DIET_TYPES.FLEXIBLE),
    sleepPattern: Joi.string().valid(...Object.values(SLEEP_PATTERNS)).default(SLEEP_PATTERNS.NORMAL),
    injuries: Joi.array().items(Joi.string()).default([]),
    equipment: Joi.array().items(Joi.string()).default([]),
    experienceYears: Joi.number().min(0).max(100).default(0),
    buddyPreferences: Joi.object().keys({
      genderPreference: Joi.string().valid(...Object.values(BUDDY_GENDER_PREFS)).default(BUDDY_GENDER_PREFS.ANY),
      levelRange: Joi.string().valid(...Object.values(BUDDY_LEVEL_RANGES)).default(BUDDY_LEVEL_RANGES.ANY),
      maxDistance: Joi.number().min(1).max(100).default(10),
      ageRange: Joi.object().keys({
        min: Joi.number().min(18).max(100).default(18),
        max: Joi.number().min(18).max(100).default(50)
      })
    })
  })
};

module.exports = {
  updateProfile,
};
