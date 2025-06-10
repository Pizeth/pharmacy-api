import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnvironmentVariables } from './validation/configuration.schema'; // Your schema

export default function configuration() {
  return {
    // Your configuration values
    NODE_ENV: process.env.NODE_ENV,
    ALLOW_PRODUCTION_SEEDING: process.env.ALLOW_PRODUCTION_SEEDING,
    // Add other required environment variables here
  };
}
