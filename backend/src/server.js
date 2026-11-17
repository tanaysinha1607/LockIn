const app = require('./app');
const config = require('./config/environment');
const connectDB = require('./config/database');
// Initialize Redis client connection
const redisClient = require('./config/redis');
const { logger } = require('./utils/logger');

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...');
  logger.error(err);
  process.exit(1);
});

const http = require('http');
const mongoose = require('mongoose');
const { initializeSocket } = require('./socket');
const challengeService = require('./services/challenge.service');

const CHALLENGE_SWEEP_MS = 60 * 60 * 1000; // hourly

const server = http.createServer(app);
let challengeTimer = null;

const start = async () => {
  await connectDB();

  initializeSocket(server);

  server.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} in ${config.env} mode`);
  });

  // Move challenges upcoming -> active -> completed and settle results. Without this,
  // ended challenges stay "active" forever unless an admin calls POST /challenges/evaluate.
  const sweepChallenges = () =>
    challengeService
      .evaluateAllChallenges()
      .then((r) => r.evaluatedCount && logger.info(`Challenge sweep settled ${r.evaluatedCount} challenge(s)`))
      .catch((err) => logger.error(`Challenge sweep failed: ${err.message}`));

  sweepChallenges();
  challengeTimer = setInterval(sweepChallenges, CHALLENGE_SWEEP_MS);
  challengeTimer.unref();
};

const shutdown = (signal) => {
  logger.info(`${signal} received. Closing server...`);
  if (challengeTimer) clearInterval(challengeTimer);
  server.close(async () => {
    await mongoose.connection.close().catch(() => {});
    if (redisClient) redisClient.disconnect();
    logger.info('Server closed cleanly.');
    process.exit(0);
  });
  // Force exit if open sockets keep the server alive
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...');
  logger.error(err);
  server.close(() => {
    process.exit(1);
  });
});

start();
