export declare const LOG_LEVELS: [
  'off',
  'log',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
];

export type LogLevel = (typeof LOG_LEVELS)[number];
export interface ExtendedWindow extends Window {
  __DEV__?: boolean;
}
