import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { SignInDto } from '../dto/signIn.dto';
import { Public } from 'src/decorators/public.decorator';
import { OidcProviderService } from 'src/modules/ocid/services/oidc-provider.service';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';

import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private providerService: OidcProviderService,
  ) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto.username, signInDto.password);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  signOut(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto.username, signInDto.password);
  }

  @Get(':provider')
  async oidcLogin(
    @Param('provider') provider: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const strategy = this.providerService.getStrategy(provider);
    if (!strategy) {
      return res.status(404).send('Provider not found');
    }

    // Create guard instance
    const guard = new (AuthGuard(strategy.name))();

    try {
      await guard.canActivate(new ExecutionContextHost([req]));
    } catch (error) {
      return this.handleAuthError(res, error, provider);
    }
  }

  @Get(':provider/callback')
  async oidcCallback(
    @Param('provider') provider: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const strategy = this.providerService.getStrategy(provider);
    if (!strategy) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=provider_not_supported`,
      );
    }

    try {
      const guard = new (AuthGuard(strategy.name))();
      await guard.canActivate(new ExecutionContextHost([req]));

      const user = req.user as any;
      const token = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role.name,
      });

      return this.handleSuccessfulAuth(res, token);
    } catch (error) {
      return this.handleAuthError(res, error, provider);
    }
  }

  private handleSuccessfulAuth(res: Response, token: string) {
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }

  private handleAuthError(res: Response, error: any, provider: string) {
    console.error(`OIDC Authentication Error (${provider}):`, error);

    let errorType = 'authentication_failed';
    let errorDescription = 'Authentication failed';

    if (error.oauthError) {
      errorType = error.oauthError.error || errorType;
      errorDescription = error.oauthError.error_description || errorDescription;
    }

    return res.redirect(
      `${process.env.FRONTEND_URL}/login?error=${errorType}&message=${encodeURIComponent(errorDescription)}`,
    );
  }
}
