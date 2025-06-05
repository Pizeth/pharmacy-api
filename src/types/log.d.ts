export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface ExtendedWindow extends Window {
  __DEV__?: boolean;
}
