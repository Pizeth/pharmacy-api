import { Module } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { UserModule } from '../users/user.module';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from 'src/guards/roles.guard';
import { PassportModule } from '@nestjs/passport';
import { OidcModule } from '../ocid/oidc.module';
import { JwtAuthGuard } from './guards/jwt.guard';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UserModule,
    PassportModule.register({ session: false }),
    OidcModule.registerAsync(),
  ],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AuthService, UserModule, LocalStrategy, JwtStrategy, OidcModule],
  controllers: [AuthController],
})
export class AuthModule {}

// ConfigModule.forFeature(oidcProviderConfig), // Makes the config injectable in this module

// Asynchronously register the OidcModule
// OidcModule.registerAsync({
//   imports: [ConfigModule.forFeature(oidcProviderConfig)], // Import config again
//   // The factory will receive the injected config
//   useFactory: (configs: OIDCProviderConfig[]) => {
//     // 'configs' is now the array of enabled providers from your file
//     return configs;
//   },
//   // Tell NestJS what to inject. `oidcProviderConfig.KEY` is the token.
//   inject: [oidcProviderConfig.KEY],
// }),
// OidcModule.register(oidcProviderConfigs),
