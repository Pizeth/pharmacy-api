import { Request, Response } from 'express';
import { AppError } from './app-errors.middleware';
import * as UAParser from 'ua-parser-js';
import clientResponse from './client-response.mddleware';

export class ErrorHandler {
  static handle(
    context: string,
    err: AppError,
    req: Request,
    res: Response,
    // next,
  ) {
    const code = err.getStatusCode() || 500;
    // Detailed error response
    clientResponse(res, code, err, err.message);

    // Optional: Log error to external service
    this.logError(context, err, req);
  }

  // Add a centralized error logging method
  static logError = (context: string, error: AppError, req: Request) => {
    const parser = new UAParser.UAParser(req.headers['user-agent'] as string);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();
    // console.log(error);

    console.error(`[${context}] Error:`, {
      message: error.getError() || error.message,
      stack: error.stack,
      code: error.getStatusCode() || null,
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
