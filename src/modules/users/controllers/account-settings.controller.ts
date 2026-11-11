import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Patch,
  Post,
  Session,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { AuthGuard, type UserSession } from '@thallesp/nestjs-better-auth';
import { z } from 'zod';
import type { Auth } from 'lib/auth';
import { PrismaService } from 'modules/prisma/services/prisma.service';
import {
  createSocialProfileSchema,
  updateSocialProfileSchema,
} from '../dto/social-profile.dto';
import type { CreateSocialProfileDto } from '../dto/social-profile.dto';
import { SocialProfilesService } from '../services/social-profiles.service';

const phoneSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(7)
      .max(32)
      .regex(/^\+?[0-9][0-9 ()-]+$/)
      .nullable(),
  })
  .strict();

const socialLinkId = z.object({ id: z.number().int().positive() }).strict();
const socialLinkUpdate = socialLinkId.extend({
  changes: updateSocialProfileSchema,
});

@Controller({ path: 'account/settings', version: VERSION_NEUTRAL })
@UseGuards(AuthGuard)
export class AccountSettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socialProfiles: SocialProfilesService,
  ) {}

  private async owner(session: UserSession<Auth>) {
    const id = Number(session.user.id);
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: { isLinked: true, isEnabled: true, banned: true, isLocked: true },
    });
    if (
      !user?.isLinked ||
      user.isEnabled === false ||
      user.banned ||
      user.isLocked
    ) {
      throw new ForbiddenException('A verified officer account is required.');
    }
    return id;
  }

  @Get()
  async get(@Session() session: UserSession<Auth>) {
    const userId = await this.owner(session);
    const [profile, links, providers] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: { phone: true },
      }),
      this.socialProfiles.list(userId),
      this.prisma.socialProvider.findMany({
        where: { isEnabled: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { phone: profile?.phone ?? null, links, providers };
  }

  @Patch('phone')
  async updatePhone(
    @Session() session: UserSession<Auth>,
    @Body({ schema: phoneSchema }) body: z.infer<typeof phoneSchema>,
  ) {
    const userId = await this.owner(session);
    const result = await this.prisma.profile.updateMany({
      where: { userId },
      data: { phone: body.phone },
    });
    if (!result.count)
      throw new NotFoundException('Officer profile not found.');
    return { phone: body.phone };
  }

  @Post('social-links')
  async createLink(
    @Session() session: UserSession<Auth>,
    @Body({ schema: createSocialProfileSchema }) body: CreateSocialProfileDto,
  ) {
    return this.socialProfiles.create(await this.owner(session), body);
  }

  @Patch('social-links')
  async updateLink(
    @Session() session: UserSession<Auth>,
    @Body({ schema: socialLinkUpdate }) body: z.infer<typeof socialLinkUpdate>,
  ) {
    return this.socialProfiles.update(
      await this.owner(session),
      body.id,
      body.changes,
    );
  }

  @Delete('social-links')
  async deleteLink(
    @Session() session: UserSession<Auth>,
    @Body({ schema: socialLinkId }) body: z.infer<typeof socialLinkId>,
  ) {
    return this.socialProfiles.delete(await this.owner(session), body.id);
  }
}
