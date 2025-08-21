import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { TokenPayload } from 'src/types/token';

export const CurrentUser = createParamDecorator((ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.user as TokenPayload;
});
