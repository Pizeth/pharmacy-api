import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { PrismaService } from 'modules/prisma/services/prisma.service';

@Controller({ path: 'health', version: VERSION_NEUTRAL }) // 👈 no version prefix
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Liveness: is the process alive?
  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: 'ok' };
  }

  // Readiness: is the app ready to serve traffic? (checks DB)
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
