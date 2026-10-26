import { Module } from '@nestjs/common';
import { UserController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import { DBHelperModule } from '../helpers/helper.module';
import { CommonModule } from 'common/common.module';
import { PasswordUtils } from 'common/services/password-utils.service';
// import { TokenService } from 'commons/services/token.service';
import { ConfigModule } from '@nestjs/config';
import { SocialProfilesController } from './controllers/social-profiles.controller';
import { SocialProfilesService } from './services/social-profiles.service';
import { SocialProvidersController } from './controllers/social-providers.controller';
import { SocialProvidersService } from './services/social-providers.service';

@Module({
  imports: [DBHelperModule, CommonModule, ConfigModule],
  providers: [
    UsersService,
    SocialProfilesService,
    SocialProvidersService,
    PasswordUtils /*, TokenService*/,
  ],
  exports: [
    UsersService,
    PasswordUtils,
    /* TokenService, */
    CommonModule,
    DBHelperModule,
  ],
  controllers: [
    UserController,
    SocialProfilesController,
    SocialProvidersController,
  ],
})
export class UserModule {}
