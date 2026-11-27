import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpStatus,
  Logger,
  NotFoundException,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Session,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { AuthGuard, type UserSession } from '@thallesp/nestjs-better-auth';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { R2Service } from 'modules/files/services/cloudflare-r2.service';
import { type } from 'types/commons.enum';
import type { Auth } from 'lib/auth';
import { PrismaService } from 'modules/prisma/services/prisma.service';
import {
  createSocialProfileSchema,
  updateSocialProfileSchema,
} from '../dto/social-profile.dto';
import type { CreateSocialProfileDto } from '../dto/social-profile.dto';
import { SocialProfilesService } from '../services/social-profiles.service';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

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
  private readonly logger = new Logger(AccountSettingsController.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly socialProfiles: SocialProfilesService,
    private readonly files: R2Service,
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

  @Patch('avatar')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: AVATAR_MAX_BYTES, files: 1, fields: 0 },
    }),
  )
  async uploadAvatar(
    @Session() session: UserSession<Auth>,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })
        .build(),
    )
    file: Express.Multer.File,
  ) {
    const where = {
      id: Number(session.user.id),
      deletedAt: null,
      emailVerified: true,
      AND: [
        { OR: [{ isEnabled: true }, { isEnabled: null }] },
        { OR: [{ banned: false }, { banned: null }] },
        { OR: [{ isLocked: false }, { isLocked: null }] },
      ],
    };
    const user = await this.prisma.user.findFirst({
      where,
      select: { id: true, image: true },
    });
    if (!user) throw new ForbiddenException('A verified email is required.');
    if (user.image)
      throw new ConflictException('This account already has an avatar.');

    const key = `avatars/${user.id}/${randomUUID()}`;
    const uploaded = await this.files.uploadFile(file, key);
    if (
      uploaded.type !== type.Upload ||
      uploaded.status !== HttpStatus.CREATED ||
      !uploaded.url
    ) {
      throw new BadRequestException('Could not upload the avatar.');
    }

    try {
      const result = await this.prisma.user.updateMany({
        where: { ...where, image: user.image },
        data: { image: uploaded.url },
      });
      if (!result.count)
        throw new ConflictException('The account changed during upload.');
      return { image: uploaded.url };
    } catch (error) {
      try {
        const cleanup = await this.files.deleteFile(uploaded.fileName);
        if (cleanup.status !== HttpStatus.OK)
          this.logger.warn('Could not clean up an unlinked avatar.');
      } catch {
        this.logger.warn('Could not clean up an unlinked avatar.');
      }
      throw error;
    }
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
