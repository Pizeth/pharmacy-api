// import jwt from 'jsonwebtoken';
// import TokenRepo from '../Repositories/refreshToken.js';
// import { AppError } from '../Utils/responseHandler.js';
// import statusCode from 'http-status-codes';
// const secretKey = process.env.SECRET_KEY || 270400;
// const refreshTokenKey = process.env.REFRESH_TOKEN_KEY || 200794;
// const expireIn = process.env.EXPIRE_IN || '900s';
// const expireRefresh = process.env.EXPIRE_REFRESH || '7d';

// // Utility for authentication token generation
// export class TokenService {
//   static generatePayload(user, req) {
//     return {
//       id: user.id,
//       username: user.username,
//       email: user.email,
//       role: user.role,
//       ip: req.ip,
//     };
//   }
//   // Generate tokens
//   static generateToken(payload, time = expireIn) {
//     return jwt.sign(payload, secretKey, { expiresIn: time });
//   }

//   // Generate refresh tokens
//   static async generateRefreshToken(payload) {
//     // const token = jwt.sign(payload, refreshTokenKey, { expiresIn: "7d" });
//     const token = this.generateToken(payload, expireRefresh);
//     try {
//       return TokenRepo.createRefreshToken(token, payload.id);
//     } catch (error) {
//       console.error('Error saving refresh token:', error);
//       throw error;
//     }
//   }

//   // Get the refresh token from database
//   static async getToken(token) {
//     try {
//       return TokenRepo.findToken(token);
//     } catch (error) {
//       console.error('Error saving fetching token:', error);
//       throw error;
//     }
//   }

//   static async remove(token) {
//     try {
//       return TokenRepo.removeTokens(token);
//     } catch (error) {
//       console.error('Error deleting token:', error);
//       throw error;
//     }
//   }

//   // Verify refresh token
//   static verifyToken(refreshToken) {
//     return jwt.verify(refreshToken, refreshTokenKey);
//   }

//   // Verify the access token
//   static verifyTokenClaims(token, req) {
//     try {
//       // Verify the token with your secret key
//       const verifiedToken = jwt.verify(token, secretKey, {
//         algorithms: ['HS256'], // Specify allowed algorithms
//         // Optional: add additional verification options
//         complete: false, // Returns the decoded payload
//       });

//       // Define required claims
//       const requiredClaims = ['id', 'username', 'email', 'role'];

//       // Check for undefined or null claims
//       const invalidClaims = requiredClaims.filter(
//         (claim) =>
//           verifiedToken[claim] === undefined ||
//           verifiedToken[claim] === null ||
//           verifiedToken[claim] === '',
//       );

//       // If any required claims are invalid, throw an error
//       if (invalidClaims.length > 0) {
//         throw new Error(
//           `Invalid token: Undefined or null claims - ${invalidClaims.join(
//             ', ',
//           )}`,
//         );
//       }

//       return verifiedToken;
//     } catch (error) {
//       // Handle different types of JWT verification errors
//       if (error.name === 'JsonWebTokenError') {
//         // Signature verification failed
//         console.error('JWT Signature Verification Failed', {
//           error: error.message,
//           ip: req.ip, // Assuming you have a method to get current IP
//         });
//         // throw new Error("Authentication failed: Invalid token signature");
//         throw new AppError(
//           'Authentication failed: Invalid token signature',
//           statusCode.UNAUTHORIZED,
//           error,
//         );

//         // // Log the error for security monitoring
//         // this.logger.security("Token verification failed", {
//         //   error: error.message,
//         //   tokenDetails: this.sanitizeTokenForLogging(decodedToken),
//         // });

//         // // Throw a generic error to prevent information leakage
//         // throw new Error("Authentication failed");
//       }

//       if (error.name === 'TokenExpiredError') {
//         console.error('JWT Token Expired', {
//           error: error.message,
//           ip: req.ip,
//         });
//         throw new AppError(
//           'Authentication failed: Token has expired',
//           statusCode.UNAUTHORIZED,
//           error,
//         );
//         // throw new Error("Authentication failed: Token has expired");
//       }

//       // Re-throw other errors
//       throw error;
//     }
//   }

//   // Helper method to sanitize token for logging
//   static sanitizeTokenForLogging(token) {
//     if (!token) return null;

//     // Create a copy of the token to avoid modifying the original
//     const sanitizedToken = { ...token };

//     // Mask sensitive information
//     const sensitiveFields = ['id', 'username', 'email'];
//     sensitiveFields.forEach((field) => {
//       if (sanitizedToken[field]) {
//         sanitizedToken[field] = this.maskSensitiveData(sanitizedToken[field]);
//       }
//     });

//     return sanitizedToken;
//   }

//   // Helper method to mask sensitive data
//   static maskSensitiveData(data) {
//     if (typeof data === 'string') {
//       return data.length > 4
//         ? `${data.substring(0, 2)}${'*'.repeat(data.length - 4)}${data.slice(
//             -2,
//           )}`
//         : '*'.repeat(data.length);
//     }
//     return data;
//   }

//   static verifyMFAToken() {}
// }

// export default TokenManager;
