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
  Id = 'id',
  Username = 'username',
  Email = 'email',
}

export enum AccessLevel {
  IS_PUBLIC_KEY = 'isPublic',
  IS_PRIVATE_KEY = 'isPrivate',
  IS_PROTECTED_KEY = 'isProtected',
}
