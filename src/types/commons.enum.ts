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
