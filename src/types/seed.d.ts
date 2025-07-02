import { AuthMethod, Role } from '@prisma/client';
import { Sex } from './commons.enum';

export interface SuperAdminData {
  username: string;
  email: string;
  password: string;
  avatar: string;
  roleId: number;
  role: Role;
  authMethod: AuthMethod | null;
  profile: {
    firstName: string;
    lastName: string;
    sex: Sex;
    dob: string;
    pob: string;
    address: string;
    phone: string;
    married: boolean;
    bio?: string;
  };
}
