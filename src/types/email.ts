import { User } from 'better-auth';

export interface Email {
  user: User;
  url: string;
  token: string;
}
