import {
  Body,
  Controller,
  Post,
  Session,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { AuthGuard, UserSession } from '@thallesp/nestjs-better-auth';
import { Auth } from 'lib/auth';
import { AccountService } from '../services/account.service';

// account.controller.ts (or wherever your custom auth-adjacent endpoints live)
@Controller({ path: 'account', version: VERSION_NEUTRAL })
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post('link-employee')
  async linkEmployee(
    @Session() session: UserSession<Auth>,
    @Body() body: { officialId: string },
  ) {
    return this.accountService.linkEmployeeId(
      Number(session.user.id),
      body.officialId,
    );
  }
}
