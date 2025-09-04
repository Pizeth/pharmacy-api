import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class DynamicOidcGuard extends AuthGuard('dynamic-oidc') {
  constructor() {
    super();
  }

  getRequest(context: ExecutionContext) {
    // const request = super.getRequest<Request>(context);
    const request = context.switchToHttp().getRequest<Request>();
    const provider = request.params.provider;

    // Store provider name to be used in strategy
    request.oidcProvider = provider;
    return request;
  }
}
