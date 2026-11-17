class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode
   * @param {string} [errorCode] machine-readable code sent to the client as `code`
   */
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.errorCode = errorCode;
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
