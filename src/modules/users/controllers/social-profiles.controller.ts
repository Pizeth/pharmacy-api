import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard, UserHasPermission } from '@thallesp/nestjs-better-auth';
import {
  createSocialProfileSchema,
  updateSocialProfileSchema,
} from '../dto/social-profile.dto';
import type {
  CreateSocialProfileDto,
  UpdateSocialProfileDto,
} from '../dto/social-profile.dto';
import { SocialProfilesService } from '../services/social-profiles.service';

@ApiTags('User Social Profiles')
@Controller({ path: 'users/:userId/social-profiles', version: '1' })
@UseGuards(AuthGuard)
@UserHasPermission({ permission: { user: ['update'] } })
export class SocialProfilesController {
  constructor(private readonly service: SocialProfilesService) {}

  @Get()
  list(@Param('userId', ParseIntPipe) userId: number) {
    return this.service.list(userId);
  }

  @Post()
  create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body({ schema: createSocialProfileSchema }) data: CreateSocialProfileDto,
  ) {
    return this.service.create(userId, data);
  }

  @Patch(':id')
  update(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateSocialProfileSchema }) data: UpdateSocialProfileDto,
  ) {
    return this.service.update(userId, id, data);
  }

  @Delete(':id')
  delete(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.delete(userId, id);
  }
}
