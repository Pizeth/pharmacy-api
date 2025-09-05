import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-custom';

@Injectable()
export class DynamicOidcStrategy extends PassportStrategy(
  Strategy,
  'dynamic-oidc',
) {
  constructor() {
    super();
  }

  validate(request: Request) {
    const providerName = request.oidcProvider;
    return { provider: providerName };
  }
}
