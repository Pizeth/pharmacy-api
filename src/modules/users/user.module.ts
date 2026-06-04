import { Module } from '@nestjs/common';
import { UserController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import { DBHelperModule } from '../helpers/helper.module';
import { CommonModule } from 'commons/common.module';
import { PasswordUtils } from 'commons/services/password-utils.service';
import { TokenService } from 'commons/services/token.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [DBHelperModule, CommonModule, ConfigModule],
  providers: [UsersService, PasswordUtils, TokenService],
  exports: [
    UsersService,
    PasswordUtils,
    TokenService,
    CommonModule,
    DBHelperModule,
  ],
  controllers: [UserController],
})
export class UserModule {}
