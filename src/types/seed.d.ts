import { Role, EmploymentStatus } from 'generated/prisma/client';
import { Sex } from './commons.enum';
import { ConfiguredProviderId } from './auth';
// import { EmploymentStatus, Prisma, Role } from 'generated/prisma/client';

export interface SuperAdminData {
  username: string;
  email: string;
  password: string;
  avatar: string;
  roleId: number;
  role: Role;
  // authMethod: AuthMethod[];
  authMethod: ConfiguredProviderId[];
  profile: {
    officialId: string;
    nationalId?: string;
    firstName: string;
    lastName: string;
    sex: Sex;
    dob: string;
    pob: string;
    nationality?: string;
    address: string;
    phone: string;
    married: boolean;
    bio?: string;
    status: EmploymentStatus;
    entryDate: Date;
    retirementAge: number;
  };
}
