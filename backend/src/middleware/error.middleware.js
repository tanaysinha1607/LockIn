const AppError = require('../utils/AppError');
const { ApiResponse } = require('../utils/apiResponse');
const { logger } = require('../utils/logger');
const environment = require('../config/environment');

/**
 * Custom error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error stack for debugging
  logger.error(err);

  // Mongoose Bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = new AppError(message, 404);
  }

  // Mongoose Duplicate Key Error (e.g. unique field)
  if (err.code === 11000) {
    const message = `Duplicate field value entered. Field: ${Object.keys(err.keyValue).join(', ')}`;
    error = new AppError(message, 400);
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    error = new AppError(message, 400);
  }

  // Joi validation error
  if (err.isJoi || (err.details && Array.isArray(err.details))) {
    const message = err.details.map((detail) => detail.message).join(', ');
    error = new AppError(message, 400);
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token. Please log in again.', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token has expired. Please log in again.', 401);
  }

  // Respond to client
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  const response = ApiResponse.error(
    message,
    environment.env === 'development' ? { stack: err.stack, details: err.details || null } : null,
    statusCode
  );

  if (error.errorCode) response.code = error.errorCode;

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
