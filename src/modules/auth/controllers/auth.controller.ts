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
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { SignInDto } from '../dto/signIn.dto';
// import { Public } from 'src/decorators/public.decorator';
import { OidcProviderService } from 'src/modules/ocid/services/oidc-provider.service';
import { Request as ExpressRequest, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AppError } from 'src/exceptions/app.exception';
import { LocalAuthGuard } from '../guards/local.guard';
import { TokenPayload } from 'src/types/token';
@Controller('auth')
export class AuthController {
  private readonly context = AuthController.name;
  private readonly logger = new Logger(this.context);
  constructor(
    private readonly authService: AuthService,
    private readonly providerService: OidcProviderService,
  ) {}

  // @Public()
  // @HttpCode(HttpStatus.OK)
  // @Post('login')
  // signIn(@Body() signInDto: SignInDto) {
  //   return this.authService.signIn(signInDto.username, signInDto.password);
  // }

  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: ExpressRequest & { user: TokenPayload }) {
    return this.authService.login(req.user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  signOut(@Body() signInDto: SignInDto) {
    // Not implemeted yet
  }

  @Get(':provider')
  @UseGuards(AuthGuard('oidc'))
  oidcLogin(@Param('provider') provider: string) {
    // Initiates OIDC flow
    // const strategy = this.providerService.getStrategy(provider);
    // if (!strategy) {
    //   throw new AppError(
    //     'Provider not found',
    //     HttpStatus.NOT_FOUND,
    //     this.context,
    //     {
    //       cause: `Provider ${provider} not found!`,
    //       validProvider: this.providerService.getAllEnabledProviders(),
    //     },
    //   );
    // }
  }

  @Get(':provider/callback')
  @UseGuards(AuthGuard('oidc'))
  async oidcCallback(
    @Param('provider') provider: string,
    @Req() req: ExpressRequest & { user: TokenPayload },
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

    // const token = this.jwtService.sign({
    //   sub: user.id,
    //   email: user.email,
    //   role: user.role.name,
    // });

    res.cookie('access_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 3600000,
      domain: process.env.COOKIE_DOMAIN,
      path: '/',
    });

    res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?token=${token.token}`,
    );
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
}
