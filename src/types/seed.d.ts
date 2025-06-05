export interface SuperAdminData {
  username: string;
  email: string;
  password: string;
  avatar: string;
  roleId?: number;
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

enum Sex {
  MALE = 'Male',
  FEMALE = 'Female',
  BI = 'Bi',
}
