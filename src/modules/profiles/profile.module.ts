import { Module } from '@nestjs/common';
import { UserModule } from '../users/user.module';
import { ProfilesController } from './controllers/profile.controller';
import { ProfilesService } from './services/profile.service';

@Module({
  imports: [UserModule],
  providers: [ProfilesService],
  exports: [ProfilesService],
  controllers: [ProfilesController],
})
export class AuthModule {}
