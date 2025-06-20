/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import type { LogLevel } from '../types/log';
import { ConfigService } from '@nestjs/config';

/**
 * Logger class for structured logging.
 *
 * @remarks
 * - Automatically detects development mode based on environment variables (`NODE_ENV`, `import.meta.env.MODE`, `__DEV__`).
 * - Use `Logger.setDevelopmentMode(isDev)` to manually override the development mode in edge cases or custom environments.
 */
@Injectable()
export class Logger {
  // Static property to override development mode
  private static forceDevelopment: boolean | null = null;
  private currentLevel: LogLevel;
  // Only log messages at or above the current level.
  private readonly levelPriority: Record<LogLevel, number> = {
    off: 0,
    log: 1,
    debug: 2,
    info: 3,
    warn: 4,
    error: 5,
    fatal: 6,
  };

  // [('verbose', 'debug', 'log', 'warn', 'error', 'fatal')];
  constructor(
    private readonly configService: ConfigService,

    // currentLevel: LogLevel = 'debug',
  ) {
    // Adjust default level as necessary
    // Initialize currentLevel directly in the constructor body
    this.currentLevel = 'debug'; // Set your desired default level here
  }

  /**
   * Manually set the development mode.
   * @param isDev - True to force development mode, false to force production mode.
   */
  static setDevelopmentMode(isDev: boolean): void {
    Logger.forceDevelopment = isDev;
  }

  /**
   * Sets the current logging level.
   * @param level - The new logging level ('debug', 'info', 'warn', 'error').
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  private isDevelopment(): boolean {
    // Use the forced value if set
    if (Logger.forceDevelopment !== null) {
      return Logger.forceDevelopment;
    }

    // Use ConfigService to check NODE_ENV or any other custom variable
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    return nodeEnv !== 'production';
  }

  // private static isDevelopment(): boolean {
  //   // Use the forced value if set
  //   if (Logger.forceDevelopment !== null) {
  //     return Logger.forceDevelopment;
  //   }
  //   // Otherwise, fall back to automatic detection
  //   return (
  //     (typeof process !== 'undefined' &&
  //       process.env.NODE_ENV !== 'production') ||
  //     (typeof import.meta !== 'undefined' &&
  //       import.meta.env?.MODE !== 'production') ||
  //     (typeof window !== 'undefined' &&
  //       (window as ExtendedWindow).__DEV__ === true)
  //   );
  // }

  // constructor(private currentLevel: LogLevel = 'debug') {}

  private shouldLog(level: LogLevel): boolean {
    // For production, you might force the level to be 'warn' or higher.
    if (!this.isDevelopment()) {
      return this.levelPriority[level] >= this.levelPriority['warn'];
    }
    return this.levelPriority[level] >= this.levelPriority[this.currentLevel];
  }

  debug(message: string, ...optionalParams: any[]) {
    if (this.shouldLog('debug')) {
      console.debug(message, ...optionalParams);
    }
  }

  info(message: string, ...optionalParams: any[]) {
    if (this.shouldLog('info')) {
      console.info(message, ...optionalParams);
    }
  }

  warn(message: string, ...optionalParams: any[]) {
    if (this.shouldLog('warn')) {
      console.warn(message, ...optionalParams);
    }
  }

  error(message: string, ...optionalParams: any[]) {
    if (this.shouldLog('error')) {
      console.error(message, ...optionalParams);
    }
  }
}
