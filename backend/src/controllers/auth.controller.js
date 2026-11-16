const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

/**
 * Register a new user
 */
const register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);
  
  res.status(201).json(
    ApiResponse.success('User registered successfully', {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    })
  );
});

/**
 * Login user
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.loginUserWithEmailAndPassword(email, password);

  res.status(200).json(
    ApiResponse.success('Logged in successfully', {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    })
  );
});

/**
 * Refresh tokens
 */
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await authService.refreshAuthTokens(refreshToken);

  res.status(200).json(
    ApiResponse.success('Tokens refreshed successfully', {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    })
  );
});

/**
 * Logout user
 */
const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken);

  res.status(200).json(
    ApiResponse.success('Logged out successfully')
  );
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
};
