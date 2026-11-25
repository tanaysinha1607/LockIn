const Redis = require('ioredis');
const config = require('./environment');
const { logger } = require('../utils/logger');

let redisClient = null;

if (!config.redis.url) {
  logger.info('REDIS_URL not set: running without Redis (rate limits use in-memory counters).');
} else try {
  redisClient = new Redis(config.redis.url, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        logger.warn('Redis reconnection attempts exceeded. Running without Redis cache/rate-limiting features.');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 500, 2000);
      return delay;
    }
  });

  redisClient.on('connect', () => {
    logger.info('Redis connection established successfully');
  });

  redisClient.on('error', (err) => {
    logger.error(`Redis connection error: ${err.message}`);
  });
} catch (error) {
  logger.error(`Failed to initialize Redis client: ${error.message}`);
}

module.exports = redisClient;
