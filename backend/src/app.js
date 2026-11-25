const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const routes = require('./routes');
const errorHandler = require('./middleware/error.middleware');
const AppError = require('./utils/AppError');
const redisClient = require('./config/redis');
const config = require('./config/environment');

const app = express();

// Behind a hosting proxy (Render): use X-Forwarded-For for the client IP
app.set('trust proxy', config.trustProxy);

// Set security HTTP headers
app.use(helmet());

// CORS: in production only the listed website(s) may call the API from a browser
app.use(
  cors(
    config.corsOrigins.length
      ? {
          origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
        }
      : {}
  )
);

// Parse JSON request body
app.use(express.json({ limit: '10kb' }));

// Parse urlencoded request body
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Sanitize data against NoSQL query injection
app.use(mongoSanitize());

// Liveness/readiness probe (no auth)
app.get('/health', (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'ok' : 'degraded',
    db: dbReady ? 'connected' : 'disconnected',
    redis: redisClient?.status === 'ready' ? 'connected' : 'unavailable',
    uptime: Math.round(process.uptime()),
  });
});

// API routes
app.use('/api/v1', routes);

// Handle unknown routes
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handler
app.use(errorHandler);

module.exports = app;
