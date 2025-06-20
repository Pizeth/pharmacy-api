// // utils/errorHandler.js
// import { UAParser } from 'ua-parser-js';
// import statusCode from 'http-status-codes';

// export class AppError extends Error {
//   private statusCode;
//   private isOperational;
//   private error;
//   public readonly name = 'AppError';
//   constructor(message: string, statusCode: string, data: object = {}) {
//     super(message);
//     this.statusCode = statusCode;
//     this.isOperational = true;
//     this.error = data;
//     Error.captureStackTrace(this, this.constructor);
//   }
// }

// // function displayStatus(code) {
// //   if (code >= 200 && code < 300) return "SUCCESS";
// //   if (code >= 400 && code < 500) return "CLIENT_ERROR_BAD_REQUEST";
// //   if (code >= 500 && code < 600) return "SEVER_ERROR";
// //   return "UNKOWN_STATUS";
// // }

// function displayStatus(code: number): string {
//   const statusGroups = {
//     100: 'INFORMATIONAL',
//     200: 'SUCCESS',
//     300: 'REDIRECTION',
//     400: 'CLIENT_ERROR',
//     500: 'SERVER_ERROR',
//   };

//   // Get the first digit of the status code
//   const firstDigit = Math.floor(code / 100) * 100;

//   return statusGroups[firstDigit] || 'UNKNOWN_STATUS';
// }

// export const clientResponse = (res, code, data, message = 'Success') => {
//   const form = {
//     request: displayStatus(code),
//     status: statusCode.getStatusText(code),
//     message: message,
//     data: data,
//     ...(process.env.NODE_ENV === 'DEVELOPMENT' && {
//       stack: data?.stack ? data.stack : null,
//     }),
//   };
//   res.status(code).json(form);
// };

// export class ErrorHandler {
//   static handle(context, err, req, res, next) {
//     const code = err.statusCode || 500;
//     // Detailed error response
//     clientResponse(res, code, err, err.message);

//     // Optional: Log error to external service
//     this.logError(context, err, req);
//   }

//   // Add a centralized error logging method
//   static logError = (context, error, req) => {
//     const parser = new UAParser(req.headers['user-agent']);
//     const browser = parser.getBrowser();
//     const os = parser.getOS();
//     const device = parser.getDevice();
//     // console.log(error);

//     console.error(`[${context}] Error:`, {
//       message: error.error || error.message,
//       stack: error.stack,
//       code: error.statusCode || null,
//       browser: browser.name,
//       os: os.name,
//       device: device,
//       path: req.path,
//       method: req.method,
//       ip: req.ip,
//       timestamp: new Date().toISOString(),
//     });
//   };
// }

// export default { AppError, ErrorHandler, clientResponse };

// import { config } from 'dotenv';
// import express from 'express';
// import logger from 'morgan';
// import cookieParser from 'cookie-parser';
// import cors from 'cors';
// import helmet from 'helmet';
// import rateLimit from 'express-rate-limit';
// import { ErrorHandler } from './src/Utils/responseHandler.js';
// import Router from './src/Routes/index.js'; // Note: .js extension is required for ES modules

// // Initialize environment variables
// config();

// const server = express();
// const port = process.env.PORT || 3030;
// const nodeEnv = process.env.NODE_ENV;

// // Middleware
// server.use(logger('dev'));
// server.use(cookieParser());
// server.use(express.json());

// server.use(helmet()); // Adds security headers
// server.use(
//   cors({
//     origin:
//       process.env.CORS_ORIGIN ||
//       'http://localhost:8080' ||
//       'http://pharmacy-ui.test',
//     methods: ['POST', 'GET', 'PUT', 'PATCH', 'DELETE', 'HEAD'],
//     credentials: true,
//     optionSuccessStatus: 200,
//   }),
// );

// // Global rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 1000, // limit each IP to 1000 requests per windowMs
//   message: 'Too many requests, please try again later',
// });

// server.use(limiter);

// // Routes
// server.use('/', Router);
// // server.use('/api/auth', authRoutes);

// // Global error handling middleware
// server.use((err, req, res, next) => {
//   ErrorHandler.handle(err.message, err, req, res, next);
// });

// // 404 handler
// server.use((req, res) => {
//   res.status(404).json({ message: 'Route not found' });
// });

// server.listen(port, () => {
//   console.log(`Server is running in port ${port} in ${nodeEnv} Mode`);
// });

// export default server;
