const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisClient = require('../config/redis');
const config = require('../config/environment');
const { ApiResponse } = require('../utils/apiResponse');
const { logger } = require('../utils/logger');

const isProd = config.env === 'production';
const MINUTE = 60 * 1000;

/**
 * Builds a limiter that counts in Redis when Redis is connected and falls back to
 * in-process memory when it isn't, so local development works without Redis.
 *
 * The Redis store is only created once the client reports 'ready': rate-limit-redis
 * loads its Lua scripts in the constructor, and doing that against a dead connection
 * produces unhandled promise rejections, which server.js treats as fatal.
 */
const buildLimiter = ({ name, windowMs, limit, message, keyGenerator }) => {
  const options = {
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // If the store errors mid-request (e.g. Redis drops), let the request through
    // rather than locking every user out.
    passOnStoreError: true,
    handler: (req, res, next, opts) => {
      res.status(opts.statusCode).json(ApiResponse.error(message, null, opts.statusCode));
    },
    ...(keyGenerator && { keyGenerator }),
  };

  const memoryLimiter = rateLimit(options);
  let redisLimiter = null;

  const initRedisLimiter = () => {
    if (redisLimiter || !redisClient) return;
    try {
      const store = new RedisStore({
        sendCommand: (command, ...args) => redisClient.call(command, ...args),
        prefix: `rl:${name}:`,
      });
      // The store kicks off SCRIPT LOAD in its constructor; never leave those unhandled.
      store.incrementScriptSha?.catch?.(() => {});
      store.getScriptSha?.catch?.(() => {});
      redisLimiter = rateLimit({ ...options, store });
      logger.info(`Rate limiter "${name}" using Redis store`);
    } catch (err) {
      logger.warn(`Rate limiter "${name}" could not use Redis, staying in memory: ${err.message}`);
    }
  };

  if (redisClient) {
    if (redisClient.status === 'ready') initRedisLimiter();
    redisClient.on('ready', initRedisLimiter);
  }

  return (req, res, next) => {
    const useRedis = redisLimiter && redisClient && redisClient.status === 'ready';
    return (useRedis ? redisLimiter : memoryLimiter)(req, res, next);
  };
};

const envNumber = (key, fallback) => {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Limits are looser outside production so the verify scripts and Expo hot reloads
// (which all come from the same IP) don't trip them. Override any of them in .env.

/** Login attempts per IP. */
const loginLimiter = buildLimiter({
  name: 'auth-login',
  windowMs: 15 * MINUTE,
  limit: envNumber('RATE_LIMIT_LOGIN', isProd ? 10 : 100),
  message: 'Too many login attempts. Please wait 15 minutes and try again.',
});

/** New accounts per IP. */
const registerLimiter = buildLimiter({
  name: 'auth-register',
  windowMs: 60 * MINUTE,
  limit: envNumber('RATE_LIMIT_REGISTER', isProd ? 5 : 100),
  message: 'Too many accounts created from this network. Please try again in an hour.',
});

/** Token refresh / logout calls per IP. */
const tokenLimiter = buildLimiter({
  name: 'auth-token',
  windowMs: 15 * MINUTE,
  limit: envNumber('RATE_LIMIT_TOKEN', isProd ? 60 : 300),
  message: 'Too many session requests. Please wait a few minutes and try again.',
});

/** OpenAI-backed endpoints, per signed-in user (must run after auth()). */
const aiLimiter = buildLimiter({
  name: 'ai',
  windowMs: 60 * MINUTE,
  limit: envNumber('RATE_LIMIT_AI', isProd ? 30 : 200),
  message: 'You have reached the AI coach limit for this hour. Please try again later.',
  keyGenerator: (req) => `user:${req.user?._id}`,
});

module.exports = {
  buildLimiter,
  loginLimiter,
  registerLimiter,
  tokenLimiter,
  aiLimiter,
};
