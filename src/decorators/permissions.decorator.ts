import { SetMetadata } from '@nestjs/common';

export const RequirePermission = (action: string, subject: string) =>
  SetMetadata('permissions', [action, subject]);
