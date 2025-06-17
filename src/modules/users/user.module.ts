import { Module } from '@nestjs/common';
import { UserController } from './controllers/users.constroler';
import { UsersService } from './services/users.service';
import { DBHelperModule } from '../helpers/helper.module';
import { CommonModule } from 'src/commons/common.module';

@Module({
  imports: [DBHelperModule, CommonModule],
  providers: [UsersService],
  exports: [UsersService],
  controllers: [UserController],
})
export class UserModule {}
