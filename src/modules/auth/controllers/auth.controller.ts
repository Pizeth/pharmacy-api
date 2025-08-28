import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  Res,
  Request,
  UseGuards,
  Put,
  Delete,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { OidcProviderService } from 'src/modules/ocid/services/oidc-provider.service';
import { Request as ExpressRequest, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AppError } from 'src/exceptions/app.exception';
import { LocalAuthGuard } from '../guards/local.guard';
import { SanitizedUser } from 'src/types/dto';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { CurrentUser } from 'src/decorators/current-user.decorator';
@Controller('auth')
export class AuthController {
  private readonly context = AuthController.name;
  private readonly logger = new Logger(this.context);
  constructor(
    private readonly authService: AuthService,
    private readonly providerService: OidcProviderService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: ExpressRequest & { user: SanitizedUser }) {
    return this.authService.login(req.user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout() {
    // With JWT, logout is typically handled client-side by removing the token
    // You could implement a blacklist if needed
    return { message: 'Logged out successfully' };
  }

  @Get(':provider')
  @UseGuards(AuthGuard('oidc'))
  oidcLogin(@Param('provider') provider: string) {
    // Initiates OIDC flow
    const strategy = this.providerService.getStrategy(provider);
    if (!strategy) {
      throw new AppError(
        'Provider not found',
        HttpStatus.NOT_FOUND,
        this.context,
        {
          cause: `Provider ${provider} not found!`,
          validProvider: this.providerService.getAllEnabledProviders(),
        },
      );
    }
  }

  @Get(':provider/callback')
  @UseGuards(AuthGuard('oidc'))
  async oidcCallback(
    @Param('provider') provider: string,
    @Req() req: ExpressRequest & { user: SanitizedUser },
    @Res() res: Response,
  ) {
    const strategy = this.providerService.getStrategy(provider);
    if (!strategy) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=provider_not_supported`,
      );
    }

    const user = req.user;
    const token = await this.authService.login(user);

    res.cookie('access_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 3600000,
      domain: process.env.COOKIE_DOMAIN,
      path: '/',
    });

    res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?token=${token.accessToken}`,
    );
    // Option B: redirect back to your frontend with tokens as fragments or set cookies.
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback#access=${encodeURIComponent(token.accessToken)}&refresh=${encodeURIComponent(token.refreshToken)}&provider=${provider}`;
    return res.redirect(redirectUrl);
  }

  // Token refresh
  @Post('refresh')
  async refresh(@Body() refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Put('link/:provider')
  @UseGuards(JwtAuthGuard)
  async linkOIDCAccount(
    @CurrentUser('id') id: string,
    @Param('provider') provider: string,
  ) {
    const oidcProvider =
      await this.providerService.getOidcIdentityProvider(provider);

    if (!oidcProvider) {
      throw new AppError(
        'Provider not found',
        HttpStatus.NOT_FOUND,
        this.context,
        {
          cause: `Provider ${provider} not found!`,
          validProvider: this.providerService.getAllEnabledProviders(),
        },
      );
    }
    // This would typically redirect to OIDC provider with a state parameter
    return { message: `Redirect to ${provider} OIDC for linking` };
  }

  @Delete('unlink/:provider')
  @UseGuards(JwtAuthGuard)
  async unlinkOIDCAccount(
    @CurrentUser('id') id: number,
    @Param('provider') provider: string,
  ) {
    await this.authService.unlinkOIDCAccount(id, provider);
    return { message: `${provider} account unlinked successfully` };
  }
}

// @Get(':provider')
// async oidcLogin(
//   @Param('provider') provider: string,
//   @Req() req: Request,
//   @Res() res: Response,
// ) {
//   const strategy = this.providerService.getStrategy(provider);
//   if (!strategy) {
//     return res.status(404).send('Provider not found');
//   }

//   // Create guard instance
//   const guard = new (AuthGuard(strategy.name))();

//   try {
//     await guard.canActivate(new ExecutionContextHost([req]));
//   } catch (error) {
//     return this.handleAuthError(res, error, provider);
//   }
// }

// private handleAuthError(res: Response, error: any, provider: string) {
//   console.error(`OIDC Authentication Error (${provider}):`, error);

//   let errorType = 'authentication_failed';
//   let errorDescription = 'Authentication failed';

//   if (error.oauthError) {
//     errorType = error.oauthError.error || errorType;
//     errorDescription = error.oauthError.error_description || errorDescription;
//   }

//   return res.redirect(
//     `${process.env.FRONTEND_URL}/login?error=${errorType}&message=${encodeURIComponent(errorDescription)}`,
//   );
// }
