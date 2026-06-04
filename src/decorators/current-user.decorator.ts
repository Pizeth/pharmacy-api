import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthMethod } from '@prisma/client';
import { Request } from 'express';
import { SanitizedUser } from 'src/types/dto';

// export const CurrentUser = createParamDecorator((ctx: ExecutionContext) => {
//   const request = ctx.switchToHttp().getRequest<Request>();
//   return request.user as TokenPayload;
// });

export const CurrentUser = createParamDecorator(
  (
    data: keyof SanitizedUser | undefined,
    ctx: ExecutionContext,
  ):
    | SanitizedUser
    | Partial<SanitizedUser>
    | string
    | number
    | boolean
    | Date
    | AuthMethod[]
    | null => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as SanitizedUser;

    return data ? user?.[data] : user;
  },
);
