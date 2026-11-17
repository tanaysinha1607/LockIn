const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/environment');

const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiration }
  );
};

const generateRefreshToken = (userId) => {
  // jti makes every refresh token unique, even two issued to the same user in the same second
  return jwt.sign(
    { userId },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiration, jwtid: crypto.randomUUID() }
  );
};

/**
 * Refresh tokens are long random JWTs, so a fast SHA-256 is enough to store them safely.
 */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwt.accessSecret);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
