const { verifyAccessToken } = require('../utils/tokenUtils');
const User = require('../models/User');
const { logger } = require('../utils/logger');

/**
 * Socket.io Middleware for Authentication
 * Verifies JWT token and attaches user information to socket
 */
const socketAuth = async (socket, next) => {
  try {
    // Retrieve token from handshake auth or query params
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      logger.warn('Socket connection rejected: No token provided');
      return next(new Error('Authentication error: Token missing'));
    }

    // Decode token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      logger.warn('Socket connection rejected: Invalid token');
      return next(new Error('Authentication error: Invalid or expired token'));
    }

    // Find User
    const user = await User.findById(decoded.userId).select('+isActive');
    if (!user || !user.isActive) {
      logger.warn(`Socket connection rejected: User ${decoded.userId} not found or inactive`);
      return next(new Error('Authentication error: Account deactivated or invalid'));
    }

    // Attach user information to socket
    socket.user = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };

    next();
  } catch (error) {
    logger.error('Socket authentication middleware error:', error);
    next(new Error('Authentication error: Internal server error'));
  }
};

module.exports = socketAuth;
