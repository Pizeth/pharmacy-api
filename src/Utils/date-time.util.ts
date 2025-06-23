// Date formatting utility functions

import { Injectable } from '@nestjs/common';

//Date formatter
@Injectable()
export class DateFormatter {
  // Format date with timezone
  static formatDateWithTimezone(
    date: Date,
    timezone: string,
    locale = 'en-US',
  ) {
    return new Date(date).toLocaleString(locale, {
      timeZone: timezone,
      dateStyle: 'full',
      timeStyle: 'long',
    });
  }

  // Format time only with timezone
  static formatTimeWithTimezone(
    date: Date,
    timezone: string,
    locale = 'en-US',
  ) {
    return new Date(date).toLocaleString(locale, {
      timeZone: timezone,
      timeStyle: 'long',
    });
  }

  // Get current date in specific timezone
  static getCurrentDateInTimezone(timezone: string, locale = 'en-US') {
    return new Date().toLocaleString(locale, {
      timeZone: timezone,
    });
  }

  // 24-hour format (14:30:45)
  static get24Hour(timezone = 'UTC') {
    return new Date().toLocaleString('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  // 12-hour format (02:30:45 PM)
  static get12Hour(timezone = 'UTC') {
    return new Date().toLocaleString('en-US', {
      timeZone: timezone,
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  // Short time (14:30)
  static getShortTime(timezone = 'UTC') {
    return new Date().toLocaleString('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Full format with timezone (14:30:45 EDT)
  static getFullTimeWithZone(timezone = 'UTC') {
    return new Date().toLocaleString('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
  }

  // Custom format with specific options
  static getCustomFormat(options = {}, timezone = 'UTC', locale = 'en-US') {
    return new Date().toLocaleString(locale, {
      timeZone: timezone,
      ...options,
    });
  }

  // ISO string format
  static getISOString() {
    return new Date().toISOString();
  }

  // Unix timestamp (milliseconds)
  static getUnixTimestamp() {
    return Date.now();
  }

  // Unix timestamp (seconds)
  static getUnixTimestampSeconds() {
    return Math.floor(Date.now() / 1000);
  }
}
