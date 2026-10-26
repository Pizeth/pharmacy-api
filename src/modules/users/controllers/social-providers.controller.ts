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
  createSocialProviderSchema,
  updateSocialProviderSchema,
} from '../dto/social-provider.dto';
import type {
  CreateSocialProviderDto,
  UpdateSocialProviderDto,
} from '../dto/social-provider.dto';
import { SocialProvidersService } from '../services/social-providers.service';

@ApiTags('Social Providers')
@Controller({ path: 'social-providers', version: '1' })
@UseGuards(AuthGuard)
export class SocialProvidersController {
  constructor(private readonly service: SocialProvidersService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  @UserHasPermission({ permission: { user: ['update'] } })
  create(
    @Body({ schema: createSocialProviderSchema }) data: CreateSocialProviderDto,
  ) {
    return this.service.create(data);
  }

  @Patch(':id')
  @UserHasPermission({ permission: { user: ['update'] } })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateSocialProviderSchema }) data: UpdateSocialProviderDto,
  ) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @UserHasPermission({ permission: { user: ['update'] } })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
