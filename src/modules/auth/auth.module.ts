import { Module } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { UserModule } from '../users/user.module';
// import { JwtModule } from '@nestjs/jwt';
// import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '../../guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { OidcModule } from '../ocid/oidc.module';
import oidcProviderConfig from '../ocid/configs/oidc.config';
import { OIDCProviderConfig } from '../ocid/interfaces/oidc.interface';

@Module({
  imports: [
    UserModule,
    PassportModule,
    OidcModule.registerAsync(),
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
  ],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AuthService, UserModule],
  controllers: [AuthController],
})
export class AuthModule {}
