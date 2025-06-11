import { ConfigValidationHelpers as validation } from 'src/configs/config-validation-helper';
import { z } from 'zod';

// Define the Zod schema for your configuration
// Your configuration schema using the enhanced helpers
export const configurationSchema = z.object({
  // Cloudflare Configuration
  R2_ACCOUNT_ID: validation.requiredString('R2_ACCOUNT_ID'),
  R2_ACCESS_KEY_ID: validation.requiredString('R2_ACCESS_KEY_ID'),
  R2_SECRET_ACCESS_KEY: validation.requiredString('R2_SECRET_ACCESS_KEY'),
  R2_BUCKET_NAME: validation.requiredString('R2_BUCKET_NAME'),
  R2_PUBLIC_DOMAIN: validation.requiredUrl('R2_PUBLIC_DOMAIN'),
  R2_EXPIRE_IN_SECONDS: validation.requiredNumber('R2_EXPIRE_IN_SECONDS'),
  R2_ALLOWED_MIME_TYPES: validation.requiredString('R2_ALLOWED_MIME_TYPES'),

  //   Virus Total Configuration
  VIRUSTOTAL_API_KEY: validation.requiredString('VIRUSTOTAL_API_KEY'),
  VIRUSTOTAL_API_URL: validation.requiredUrl('VIRUSTOTAL_API_URL'),
  VIRUSTOTAL_API_RATE_LIMIT: validation.requiredNumber(
    'VIRUSTOTAL_API_RATE_LIMIT',
  ),
  VIRUS_TOTAL_MAX_SIZE: validation.requiredNumber('VIRUS_TOTAL_MAX_SIZE'),

  // QR Code Properties
  QR_CODE_URL: validation.requiredUrl('QR_CODE_URL'),
  QR_CODE_BACK_COLOR: validation.requiredString('QR_CODE_BACK_COLOR'),
  QR_CODE_TRANSPARENT: validation.requiredString('QR_CODE_TRANSPARENT'),
  QR_CODE_QUIET_ZONE: validation.requiredNumber('QR_CODE_QUIET_ZONE'),
  QR_CODE_QUIET_UNIT: validation.requiredString('QR_CODE_QUIET_UNIT'),
  QR_CODE_SIZE: validation.requiredString('QR_CODE_SIZE'),
  QR_CODE_ERROR_CORRECTION: validation.requiredString(
    'QR_CODE_ERROR_CORRECTION',
  ),

  //Security Keys
  MAIL_VERIFY_KEY: validation.requiredString('MAIL_VERIFY_KEY'),
  SECRET_KEY: validation.requiredString('SECRET_KEY'),
  REFRESH_TOKEN_KEY: validation.requiredString('REFRESH_TOKEN_KEY'),
  EXPIRE_IN: validation.requiredString('EXPIRE_IN'),
  EXPIRE_REFRESH: validation.requiredString('EXPIRE_REFRESH'),
  CORS_ORIGIN: validation.requiredString('CORS_ORIGIN'),

  PASSKEY: validation.requiredString('PASSKEY'),
  LOCKED: validation.requiredNumber('LOCKED'),

  // Optional with defaults
  PORT: validation.optionalNumber(3000),
  ALLOWED_ORIGIN: validation.optionalString('http://localhost:3000'),
  SALT: validation.optionalNumber(12),
  NODE_ENV: validation.optionalString('development'),
  ALLOW_PRODUCTION_SEEDING: validation.requiredBoolean(
    'ALLOW_PRODUCTION_SEEDING',
  ),

  // Specialized validations (uncomment as needed)
  DATABASE_URL: validation.requiredUrl('DATABASE_URL'),
  DIRECT_URL: validation.requiredUrl('DIRECT_URL'),
  // ADMIN_EMAIL: ConfigValidationHelpers.requiredEmail('ADMIN_EMAIL'),
  // JWT_SECRET: ConfigValidationHelpers.requiredStringWithLength('JWT_SECRET', 32),
  // API_KEY: ConfigValidationHelpers.requiredStringWithLength('API_KEY', 32, 64), // Example with min and max length
  // SESSION_SECRET: ConfigValidationHelpers.requiredStringWithLength('SESSION_SECRET', 32), // Example with only min length
});
