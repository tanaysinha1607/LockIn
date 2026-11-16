const User = require('../models/User');
const Streak = require('../models/Streak');
const AppError = require('../utils/AppError');
const tokenUtils = require('../utils/tokenUtils');
const bcrypt = require('bcryptjs');

/**
 * Register a user and initialize their streak.
 * @param {Object} userBody 
 * @returns {Promise<Object>} user, accessToken, refreshToken
 */
const registerUser = async (userBody) => {
  if (await User.findOne({ email: userBody.email })) {
    throw new AppError('Email is already registered', 400);
  }

  const user = await User.create(userBody);
  
  // Auto-initialize streak document for this user
  await Streak.create({
    userId: user._id,
  });

  const accessToken = tokenUtils.generateAccessToken(user._id, user.role);
  const refreshToken = tokenUtils.generateRefreshToken(user._id);

  // Hash and save refresh token
  const salt = await bcrypt.genSalt(12);
  const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);
  
  await User.findByIdAndUpdate(user._id, { refreshToken: hashedRefreshToken });

  return {
    user,
    accessToken,
    refreshToken,
  };
};

/**
 * Login with email and password.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<Object>} user, accessToken, refreshToken
 */
const loginUserWithEmailAndPassword = async (email, password) => {
  const user = await User.findOne({ email }).select('+password +isActive');
  
  if (!user || !user.isActive || !(await user.comparePassword(password))) {
    throw new AppError('Incorrect email or password', 401);
  }

  const accessToken = tokenUtils.generateAccessToken(user._id, user.role);
  const refreshToken = tokenUtils.generateRefreshToken(user._id);

  // Hash and store refresh token
  const salt = await bcrypt.genSalt(12);
  const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);
  
  user.refreshToken = hashedRefreshToken;
  user.lastActive = new Date();
  await user.save();

  // Hide password from output
  user.password = undefined;

  return {
    user,
    accessToken,
    refreshToken,
  };
};

/**
 * Refresh access and refresh tokens (rotates refresh token).
 * @param {string} refreshToken 
 * @returns {Promise<Object>} accessToken, refreshToken
 */
const refreshAuthTokens = async (refreshToken) => {
  try {
    const decoded = tokenUtils.verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId).select('+refreshToken');

    if (!user || !user.refreshToken) {
      throw new AppError('Unauthorized. Session expired.', 401);
    }

    // Compare token with stored hash
    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isMatch) {
      // Token reuse detection: invalidate all user refresh tokens on mismatch (security precaution)
      await User.findByIdAndUpdate(user._id, { refreshToken: null });
      throw new AppError('Suspicious activity detected. All sessions terminated. Please login again.', 401);
    }

    const newAccessToken = tokenUtils.generateAccessToken(user._id, user.role);
    const newRefreshToken = tokenUtils.generateRefreshToken(user._id);

    const salt = await bcrypt.genSalt(12);
    const hashedNewRefreshToken = await bcrypt.hash(newRefreshToken, salt);

    user.refreshToken = hashedNewRefreshToken;
    user.lastActive = new Date();
    await user.save();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid or expired refresh token', 401);
  }
};

/**
 * Logout - clear user refresh token.
 * @param {string} refreshToken 
 */
const logout = async (refreshToken) => {
  if (!refreshToken) {
    return;
  }

  try {
    const decoded = tokenUtils.verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId).select('+refreshToken');

    if (user && user.refreshToken) {
      const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
      if (isMatch) {
        user.refreshToken = null;
        await user.save();
      }
    }
  } catch {
    // Client may clear local session even if refresh token is expired or invalid
  }
};

module.exports = {
  registerUser,
  loginUserWithEmailAndPassword,
  refreshAuthTokens,
  logout,
};
