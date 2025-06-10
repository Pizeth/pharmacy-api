// type tokenRole = Omit<
//   Role,
//   | 'enabledFlag'
//   | 'createdBy'
//   | 'createdDate'
//   | 'lastUpdatedBy'
//   | 'lastUpdatedDate'
//   | 'objectVersionId'
// >;

interface RoleToken {
  id: number;
  name: string;
  descrition: string | null;
}
export interface TokenPayload {
  id: number;
  username: string;
  email: string;
  roleId: number;
  role: RoleToken | undefined;
  ip: string;
}

// interface TokenPayload {
//   userId: number;
//   username: string;
//   email: string;
//   role: Role | string;
// }
