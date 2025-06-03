// utils/errorHandler.js
import { UAParser } from 'ua-parser-js';
import statusCode from 'http-status-codes';

export class AppError extends Error {
  private statusCode;
  private isOperational;
  private error;
  public readonly name = 'AppError';
  constructor(message: string, statusCode: string, data: object = {}) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.error = data;
    Error.captureStackTrace(this, this.constructor);
  }
}

// function displayStatus(code) {
//   if (code >= 200 && code < 300) return "SUCCESS";
//   if (code >= 400 && code < 500) return "CLIENT_ERROR_BAD_REQUEST";
//   if (code >= 500 && code < 600) return "SEVER_ERROR";
//   return "UNKOWN_STATUS";
// }

function displayStatus(code: number): string {
  const statusGroups = {
    100: 'INFORMATIONAL',
    200: 'SUCCESS',
    300: 'REDIRECTION',
    400: 'CLIENT_ERROR',
    500: 'SERVER_ERROR',
  };

  // Get the first digit of the status code
  const firstDigit = Math.floor(code / 100) * 100;

  return statusGroups[firstDigit] || 'UNKNOWN_STATUS';
}

export const clientResponse = (res, code, data, message = 'Success') => {
  const form = {
    request: displayStatus(code),
    status: statusCode.getStatusText(code),
    message: message,
    data: data,
    ...(process.env.NODE_ENV === 'DEVELOPMENT' && {
      stack: data?.stack ? data.stack : null,
    }),
  };
  res.status(code).json(form);
};

export class ErrorHandler {
  static handle(context, err, req, res, next) {
    const code = err.statusCode || 500;
    // Detailed error response
    clientResponse(res, code, err, err.message);

    // Optional: Log error to external service
    this.logError(context, err, req);
  }

  // Add a centralized error logging method
  static logError = (context, error, req) => {
    const parser = new UAParser(req.headers['user-agent']);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();
    // console.log(error);

    console.error(`[${context}] Error:`, {
      message: error.error || error.message,
      stack: error.stack,
      code: error.statusCode || null,
      browser: browser.name,
      os: os.name,
      device: device,
      path: req.path,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
  };
}

export default { AppError, ErrorHandler, clientResponse };
