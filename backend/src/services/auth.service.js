const User = require('../models/User');
const Streak = require('../models/Streak');
const AppError = require('../utils/AppError');
const tokenUtils = require('../utils/tokenUtils');

// How many devices can stay signed in at once; the oldest session is dropped beyond this.
const MAX_SESSIONS_PER_USER = 5;

/**
 * Issue a new access/refresh pair and remember the refresh token's hash for this device.
 */
const issueTokens = async (user) => {
  const accessToken = tokenUtils.generateAccessToken(user._id, user.role);
  const refreshToken = tokenUtils.generateRefreshToken(user._id);

  await User.updateOne(
    { _id: user._id },
    {
      $push: { refreshTokens: { $each: [tokenUtils.hashToken(refreshToken)], $slice: -MAX_SESSIONS_PER_USER } },
      $set: { lastActive: new Date() },
    }
  );

  return { accessToken, refreshToken };
};

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

  const tokens = await issueTokens(user);
  user.password = undefined;

  return { user, ...tokens };
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

  const tokens = await issueTokens(user);

  // Hide password from output
  user.password = undefined;

  return { user, ...tokens };
};

/**
 * Refresh access and refresh tokens (rotates the refresh token for this device only).
 * @param {string} refreshToken
 * @returns {Promise<Object>} accessToken, refreshToken
 */
const refreshAuthTokens = async (refreshToken) => {
  let decoded;
  try {
    decoded = tokenUtils.verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const tokenHash = tokenUtils.hashToken(refreshToken);

  // Atomically consume this device's token so it can only be used once
  const user = await User.findOneAndUpdate(
    { _id: decoded.userId, refreshTokens: tokenHash, isActive: true },
    { $pull: { refreshTokens: tokenHash } },
    { new: true }
  );

  if (!user) {
    // A validly signed token that is no longer stored was already used (or the user logged
    // out). Treat it as a stolen token and sign the account out everywhere.
    await User.updateOne({ _id: decoded.userId }, { $set: { refreshTokens: [] } });
    throw new AppError('Session expired. Please log in again.', 401);
  }

  return issueTokens(user);
};

/**
 * Logout - forget this device's refresh token. Other devices stay signed in.
 * @param {string} refreshToken
 */
const logout = async (refreshToken) => {
  if (!refreshToken) {
    return;
  }

  try {
    const decoded = tokenUtils.verifyRefreshToken(refreshToken);
    await User.updateOne(
      { _id: decoded.userId },
      { $pull: { refreshTokens: tokenUtils.hashToken(refreshToken) } }
    );
  } catch {
    // Client may clear local session even if refresh token is expired or invalid
  }
};

module.exports = {
  registerUser,
  loginUserWithEmailAndPassword,
  refreshAuthTokens,
  logout,
  MAX_SESSIONS_PER_USER,
};
