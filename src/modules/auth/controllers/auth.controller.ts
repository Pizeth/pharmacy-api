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
// import { AuthGuard } from '@nestjs/passport';
import { AppError } from 'src/exceptions/app.exception';
import { LocalAuthGuard } from '../guards/local.guard';
import { SanitizedUser, SignedUser } from 'src/types/dto';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { DynamicOidcGuard } from '../guards/oidc.guard';
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

  // @Get(':provider')
  // @UseGuards(AuthGuard('oidc'))
  // oidcLogin(@Param('provider') provider: string) {
  //   // Initiates OIDC flow
  //   const strategy = this.providerService.getStrategy(provider);
  //   if (!strategy) {
  //     throw new AppError(
  //       'Provider not found',
  //       HttpStatus.NOT_FOUND,
  //       this.context,
  //       {
  //         cause: `Provider ${provider} not found!`,
  //         validProvider: this.providerService.getAllEnabledProviders(),
  //       },
  //     );
  //   }
  // }

  @Get(':provider')
  @UseGuards(DynamicOidcGuard) // ✅ Use dynamic guard
  oidcLogin(@Param('provider') provider: string) {
    // This guard will handle the strategy selection
    // No additional logic needed here

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
  // @UseGuards(AuthGuard('oidc'))
  @UseGuards(DynamicOidcGuard) // ✅ Use dynamic guard
  async oidcCallback(
    @Param('provider') provider: string,
    @Req() req: ExpressRequest & { user: SanitizedUser },
    @Res() res: Response,
  ) {
    try {
      const strategy = this.providerService.getStrategy(provider);
      if (!strategy) {
        return res.redirect(
          `${process.env.FRONTEND_URL}/login?error=provider_not_supported`,
        );
      }

      // Check if authentication was successful
      const user = req.user;
      if (!user) {
        return res.redirect(
          `${process.env.FRONTEND_URL}/login?error=authentication_failed`,
        );
      }

      const signedUser = await this.authService.login(user);

      // Option A: Set cookie (for traditional web apps)
      res.cookie('access_token', signedUser.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 3600000, // 1 hour
        domain: process.env.COOKIE_DOMAIN || 'localhost',
        path: '/',
      });

      // Option B: redirect back to your frontend with tokens as fragments or set cookies.
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback#access_token=${encodeURIComponent(
        signedUser.accessToken,
      )}&refresh_token=${encodeURIComponent(signedUser.refreshToken)}&provider=${provider}`;

      return res.redirect(redirectUrl);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      this.logger.error('Error occurred during OIDC callback:', error);
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(errorMessage)}`,
      );
    }
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

@Controller('auth')
export class AuthControllerGemini {
  constructor(
    private readonly authService: AuthService,
    // We still might need this for linking/unlinking logic
    private readonly providerService: OidcProviderService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(
    @Request() req: ExpressRequest & { user: SanitizedUser },
  ): Promise<SignedUser> {
    return this.authService.login(req.user);
  }

  // REVISED: Use the new DynamicOidcAuthGuard for both the initial redirect and the callback.
  @Get(':provider')
  @UseGuards(DynamicOidcGuard)
  oidcLogin(@Param('provider') provider: string) {
    // This function will now correctly initiate the OIDC flow
    // because the guard will select the right strategy.
    // The body of this function is intentionally left empty.
  }

  @Get(':provider/callback')
  @UseGuards(DynamicOidcGuard)
  async oidcCallback(
    @Req() req: ExpressRequest & { user: SanitizedUser },
    @Res() res: Response,
  ) {
    // The user object is now attached to the request by the Passport strategy.
    const signedUser = await this.authService.login(req.user);

    // FIX: Simplified and safer redirect. Avoid putting tokens directly in the URL if possible.
    // Using a cookie is a good approach, or a short-lived state token.
    // Here we redirect and let a frontend script pick up the token from a fragment.
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback#access_token=${encodeURIComponent(
      signedUser.accessToken,
    )}&refresh_token=${encodeURIComponent(signedUser.refreshToken)}`;

    res.redirect(redirectUrl);
  }

  // ... other methods like logout, refresh, link, unlink ...
  // The logic for these seems correct and doesn't need to change.
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
