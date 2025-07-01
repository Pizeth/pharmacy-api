import { Module } from '@nestjs/common';
import { UserController } from './controllers/users.constroler';
import { UsersService } from './services/users.service';
import { DBHelperModule } from '../helpers/helper.module';
import { CommonModule } from 'src/commons/common.module';
import { PasswordUtils } from 'src/commons/services/password-utils.service';
import { TokenService } from 'src/commons/services/token.service';

@Module({
  imports: [DBHelperModule, CommonModule],
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
