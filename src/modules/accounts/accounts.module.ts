import { Module } from '@nestjs/common';
import { AccountService } from './services/account.service';
import { AccountController } from './controllers/account.controller';

@Module({
  providers: [AccountService],
  controllers: [AccountController]
})
export class AccountsModule {}
