class ApiResponse {
  constructor(statusCode, success, message, data = null, meta = null) {
    this.statusCode = statusCode;
    this.success = success;
    this.message = message;
    if (data !== null) this.data = data;
    if (meta !== null) this.meta = meta;
  }

  static success(message, data = null, meta = null) {
    return {
      success: true,
      message,
      ...(data !== null && { data }),
      ...(meta !== null && { meta })
    };
  }

  static error(message, error = null, statusCode = 500) {
    return {
      success: false,
      message,
      ...(error !== null && { error }),
      statusCode
    };
  }
}

module.exports = { ApiResponse };
