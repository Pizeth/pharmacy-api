import { HttpStatus } from '@nestjs/common';

export enum Sex {
  MALE = 'Male',
  FEMALE = 'Female',
  BI = 'Bi',
}

// Defines the type of action performed.
export enum AuditActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOCKED = 'LOCKED',
  BANNED = 'BANNED',
  DISABLED = 'DISABLED',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  // Add other specific business logic events as needed
}

// Defines the target entity/table for the audit event.
// This list should include all models you want to audit.
export enum AuditTargetType {
  User = 'User',
  Role = 'Role',
  Profile = 'Profile',
  Product = 'Product',
  Category = 'Category',
  SubCategory = 'SubCategory',
  Order = 'Order',
  OrderLine = 'OrderLine',
  Invoice = 'Invoice',
  Customer = 'Customer',
  Supplier = 'Supplier',
  // Add other models as they become auditable
}

export enum type {
  Upload = 'upload',
  Delete = 'delete',
  Error = 'error',
}
// Common HTTP error codes;
export enum HttpErrorStatusEnum {
  BadRequest = HttpStatus.BAD_REQUEST,
  Forbidden = HttpStatus.FORBIDDEN,
  NotFound = HttpStatus.NOT_FOUND,
  Unauthorized = HttpStatus.UNAUTHORIZED,
  RequestTooLong = HttpStatus.PAYLOAD_TOO_LARGE,
  InternalServerError = HttpStatus.INTERNAL_SERVER_ERROR,
  ServiceUnavailable = HttpStatus.SERVICE_UNAVAILABLE,
}

// Enum for common error scenarios (optional)
export enum R2ErrorCode {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  ACCESS_DENIED = 'ACCESS_DENIED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  BUCKET_NOT_FOUND = 'BUCKET_NOT_FOUND',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}

// Define the available avatar styles using an enum.
export enum DiceBearStyle {
  Adventurer = 'adventurer',
  AdventurerNeutral = 'adventurer-neutral',
  Avataaars = 'avataaars',
  AvataaarsNeutral = 'avataaars-neutral',
  BigEars = 'big-ears',
  BigEarsNeutral = 'big-ears-neutral',
  BigSmile = 'big-smile',
  Bottts = 'bottts',
  BotttsNeutral = 'bottts-neutral',
  Croodles = 'croodles',
  CroodlesNeutral = 'croodles-neutral',
  Dylan = 'dylan',
  FunEmoji = 'fun-emoji',
  Glass = 'glass',
  Icons = 'icons',
  Identicon = 'identicon',
  Initials = 'initials',
  Lorelei = 'lorelei',
  LoreleiNeutral = 'lorelei-neutral',
  Micah = 'micah',
  Miniavs = 'miniavs',
  Notionists = 'notionists',
  NotionistsNeutral = 'notionists-neutral',
  OpenPeeps = 'open-peeps',
  Personas = 'personas',
  PixelArt = 'pixel-art',
  PixelArtNeutral = 'pixel-art-neutral',
  Rings = 'rings',
  Shapes = 'shapes',
  Thumbs = 'thumbs',
}

export enum ImageFormat {
  SVG = 'svg',
  PNG = 'png',
  JPG = 'jpg',
  JPEG = 'jpeg',
  WEBP = 'webp',
  AVIF = 'avif',
  JSON = 'json',
}

// **NEW**: Create an enum for your available bundled fonts.
// The key should match what you want users to type in the query param.
// The value should match the filename in your `src/assets/fonts` directory.
export enum AvailableFonts {
  NotoSans = 'NotoSans-VariableFont_wdth,wght.ttf',
  NotoSansKhmer = 'NotoSansKhmer-VariableFont_wdth,wght.ttf',
  KantumruyPro = 'KantumruyPro-VariableFont_wght.ttf',
  OpenSans = 'OpenSans-VariableFont_wdth,wght.ttf',
  RobotoBold = 'Roboto-VariableFont_wdth,wght.ttf',
}

export enum SensitiveField {
  sub = 'sub',
  Username = 'username',
  Email = 'email',
}

export enum AccessLevel {
  IS_PUBLIC_KEY = 'isPublic',
  IS_PRIVATE_KEY = 'isPrivate',
  IS_PROTECTED_KEY = 'isProtected',
}

// export enum UnitTime {
//   MS = 'ms',
//   S = 's',
//   MN = 'mn',
//   H = 'h',
//   D = 'd',
//   W = 'w',
//   M = 'm',
//   Y = 'y',
// }

// export enum UnitMap {
//   ms = 1,
//   s = 1000,
//   mn = 60_000,
//   h = 3_600_000,
//   d = 86_400_000,
//   w = 604_800_000,
//   m = 2_629_746_000, // Approx. 1 month = 30.44 days
//   y = 31_557_600_000, // Approx. 1 year = 365.25 days
// }

export enum AmbiguousUnit {
  M = 'm',
}

// Combined configuration with aliases and multipliers
const UNIT_CONFIG: Record<string, { unit: string; multiplier: number }> = {
  // export const unitConfig = {
  // Milliseconds
  ms: { unit: 'ms', multiplier: 1 },
  millisecond: { unit: 'ms', multiplier: 1 },
  milliseconds: { unit: 'ms', multiplier: 1 },

  // Seconds
  s: { unit: 's', multiplier: 1000 },
  sec: { unit: 's', multiplier: 1000 },
  secs: { unit: 's', multiplier: 1000 },
  second: { unit: 's', multiplier: 1000 },
  seconds: { unit: 's', multiplier: 1000 },

  // Minutes
  mn: { unit: 'min', multiplier: 60_000 },
  min: { unit: 'min', multiplier: 60_000 },
  mins: { unit: 'min', multiplier: 60_000 },
  minute: { unit: 'min', multiplier: 60_000 },
  minutes: { unit: 'min', multiplier: 60_000 },

  // Hours
  h: { unit: 'h', multiplier: 3_600_000 },
  hr: { unit: 'h', multiplier: 3_600_000 },
  hrs: { unit: 'h', multiplier: 3_600_000 },
  hour: { unit: 'h', multiplier: 3_600_000 },
  hours: { unit: 'h', multiplier: 3_600_000 },

  // Days
  d: { unit: 'd', multiplier: 86_400_000 },
  day: { unit: 'd', multiplier: 86_400_000 },
  days: { unit: 'd', multiplier: 86_400_000 },

  // Weeks
  w: { unit: 'w', multiplier: 604_800_000 },
  wk: { unit: 'w', multiplier: 604_800_000 },
  wks: { unit: 'w', multiplier: 604_800_000 },
  week: { unit: 'w', multiplier: 604_800_000 },
  weeks: { unit: 'w', multiplier: 604_800_000 },

  // Months
  // mo: { unit: 'mo', multiplier: 2_629_746_000 },
  // m: { unit: 'mo', multiplier: 2_629_746_000 },
  // month: { unit: 'mo', multiplier: 2_629_746_000 },
  // months: { unit: 'mo', multiplier: 2_629_746_000 },

  // Years
  y: { unit: 'y', multiplier: 31_557_600_000 },
  yr: { unit: 'y', multiplier: 31_557_600_000 },
  yrs: { unit: 'y', multiplier: 31_557_600_000 },
  year: { unit: 'y', multiplier: 31_557_600_000 },
  years: { unit: 'y', multiplier: 31_557_600_000 },
};

// Valid unit values for type safety
// export type UnitTime = 'ms' | 's' | 'min' | 'h' | 'd' | 'w' | 'mo' | 'y';

// 2) Canonical keys of valid unit values for type safety
export type UnitTime = (typeof UNIT_CONFIG)[keyof typeof UNIT_CONFIG]['unit'];
// Reverse lookup table for multipliers by canonical unit
export const UNIT_MULTIPLIERS: Record<UnitTime, number> = Object.values(
  UNIT_CONFIG,
).reduce(
  (map, { unit, multiplier }) => {
    if (!map[unit]) map[unit] = multiplier;
    return map;
  },
  {} as Record<UnitTime, number>,
);

export const ALIAS_MAP: Record<string, UnitTime> = Object.entries(
  UNIT_CONFIG,
).reduce(
  (acc, [alias, { unit }]) => {
    acc[alias] = unit;
    return acc;
  },
  {} as Record<string, UnitTime>,
);
