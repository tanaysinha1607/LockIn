const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/tokenUtils');
const User = require('../models/User');

const auth = (...roles) => asyncHandler(async (req, res, next) => {
  let token;
  
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Please authenticate. Authorization token missing.', 401));
  }

  try {
    const decoded = verifyAccessToken(token);
    
    const user = await User.findById(decoded.userId).select('+isActive');
    if (!user || !user.isActive) {
      return next(new AppError('The user belonging to this token no longer exists or is deactivated.', 401));
    }

    if (roles.length && !roles.includes(decoded.role)) {
      return next(new AppError('Forbidden. You do not have permission to access this resource.', 403));
    }

    // Attach user information to request
    req.user = user;
    next();
  } catch (error) {
    return next(new AppError('Unauthorized. Invalid or expired token.', 401));
  }
});

module.exports = auth;
