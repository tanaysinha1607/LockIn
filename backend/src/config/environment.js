const Joi = require('joi');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = Joi.object({
  PORT: Joi.number().default(5000),
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
  MONGODB_URI: Joi.string().required().description('MongoDB connection URI'),
  REDIS_URL: Joi.string().required().description('Redis connection URL'),
  ACCESS_TOKEN_SECRET: Joi.string().min(8).required().description('JWT Access Token secret key'),
  REFRESH_TOKEN_SECRET: Joi.string().min(8).required().description('JWT Refresh Token secret key'),
  ACCESS_TOKEN_EXPIRE: Joi.string().default('15m'),
  REFRESH_TOKEN_EXPIRE: Joi.string().default('7d'),
  OPENAI_API_KEY: Joi.string().allow('').optional().description('OpenAI Api Key (required when AI features are enabled)'),
  OPENAI_ORG_ID: Joi.string().allow('').optional(),
  AI_ENABLED: Joi.boolean().default(true),
  AI_DAILY_BUDGET_CENTS: Joi.number().default(500),
  CHECKIN_RADIUS_METERS: Joi.number().min(50).max(5000).default(300),
  CHECKIN_REQUIRE_GPS: Joi.boolean().optional(),
  GYM_LOCATION_COOLDOWN_DAYS: Joi.number().min(0).max(365).default(7),
}).unknown(true);

const { error, value: envVars } = envSchema.validate(process.env, { abortEarly: false });

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongoose: {
    url: envVars.MONGODB_URI,
    options: {}
  },
  redis: {
    url: envVars.REDIS_URL
  },
  jwt: {
    accessSecret: envVars.ACCESS_TOKEN_SECRET,
    refreshSecret: envVars.REFRESH_TOKEN_SECRET,
    accessExpiration: envVars.ACCESS_TOKEN_EXPIRE,
    refreshExpiration: envVars.REFRESH_TOKEN_EXPIRE
  },
  checkIn: {
    radiusMeters: envVars.CHECKIN_RADIUS_METERS,
    // Default: GPS required in production, optional elsewhere so scripts and desktop testing work
    requireGps: envVars.CHECKIN_REQUIRE_GPS ?? envVars.NODE_ENV === 'production',
    gymLocationCooldownDays: envVars.GYM_LOCATION_COOLDOWN_DAYS,
  },
  openai: {
    apiKey: envVars.OPENAI_API_KEY,
    orgId: envVars.OPENAI_ORG_ID,
    enabled: envVars.AI_ENABLED,
    dailyBudget: envVars.AI_DAILY_BUDGET_CENTS
  }
};
