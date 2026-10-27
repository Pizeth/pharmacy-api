import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  AuthGuard,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import type { Auth } from 'lib/auth';
import type { Request } from 'express';
import { RolesService } from './roles.service';
import {
  roleInputSchema,
  roleUpdateSchema,
  roleDeleteSchema,
  type RoleInput,
  type RoleUpdate,
} from './roles.schemas';
@Controller({ path: 'roles', version: '1' })
@UseGuards(AuthGuard)
export class RolesController {
  constructor(private readonly service: RolesService) {}
  private user(session: UserSession<Auth>) {
    const id = Number(session?.user?.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new UnauthorizedException();
    return id;
  }
  @Get('metadata') metadata(@Session() session: UserSession<Auth>) {
    return this.service.metadata(this.user(session));
  }
  @Get() list(@Session() session: UserSession<Auth>) {
    return this.service.list(this.user(session));
  }
  @Get(':id') get(
    @Session() session: UserSession<Auth>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.get(this.user(session), id);
  }
  @Post() create(
    @Session() session: UserSession<Auth>,
    @Body({ schema: roleInputSchema }) input: RoleInput,
    @Req() request: Request,
  ) {
    return this.service.save(
      this.user(session),
      input,
      undefined,
      request.ip ?? 'unknown',
    );
  }
  @Patch(':id') update(
    @Session() session: UserSession<Auth>,
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: roleUpdateSchema }) input: RoleUpdate,
    @Req() request: Request,
  ) {
    return this.service.save(
      this.user(session),
      input,
      id,
      request.ip ?? 'unknown',
    );
  }
  @Delete(':id') remove(
    @Session() session: UserSession<Auth>,
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: roleDeleteSchema }) input: { version: number },
    @Req() request: Request,
  ) {
    return this.service.remove(
      this.user(session),
      id,
      input.version,
      request.ip ?? 'unknown',
    );
  }
}
