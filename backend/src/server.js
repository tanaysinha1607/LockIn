const app = require('./app');
const config = require('./config/environment');
const connectDB = require('./config/database');
// Initialize Redis client connection
require('./config/redis');
const { logger } = require('./utils/logger');

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...');
  logger.error(err);
  process.exit(1);
});

const http = require('http');
const { initializeSocket } = require('./socket');

// Connect to Database
connectDB();

const server = http.createServer(app);
initializeSocket(server);

server.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.env} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...');
  logger.error(err);
  server.close(() => {
    process.exit(1);
  });
});
