// type tokenRole = Omit<
//   Role,
//   | 'enabledFlag'
//   | 'createdBy'
//   | 'createdDate'
//   | 'lastUpdatedBy'
//   | 'lastUpdatedDate'
//   | 'objectVersionId'
// >;

import { AuthMethod } from '@prisma/client';
import { SensitiveField } from './commons.enum';

interface RoleToken {
  id: number;
  name: string;
  description: string | null;
}

export interface TokenPayload {
  sub: number;
  username: string;
  email: string;
  avatar: string | null;
  role: RoleToken;
  authMethod: AuthMethod[] | null;
  ip: string;
}

// const sensitiveFields = ['id', 'username', 'email'] as const;

// export type SensitiveKey = (typeof sensitiveFields)[number]; // 'id'|'username'|'email'

// export type Sanitized<T, K extends keyof T> = Omit<T, K> & Record<K, string>;

export type SensitiveKey = (typeof SensitiveField)[keyof typeof SensitiveField];

// export type Sanitized<T> = Omit<T, SensitiveKey> & Record<SensitiveKey, string>;
export type Sanitized<T> = {
  [P in keyof T]: P extends SensitiveKey ? string : T[P];
};

// interface TokenPayload {
//   userId: number;
//   username: string;
//   email: string;
//   role: Role | string;
// }
