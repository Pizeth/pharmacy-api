import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { HealthService } from '../services/health.service';

@AllowAnonymous()
@Controller({ path: 'health', version: VERSION_NEUTRAL }) // 👈 no version prefix
export class HealthController {
  constructor(private readonly health: HealthService) {}

  // Liveness: is the process alive?
  @Get('live')
  @HttpCode(HttpStatus.OK)
  live(): Record<string, unknown> {
    return this.health.getLiveness();
  }

  // Readiness: is the app ready to serve traffic? (checks DB)
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready(): Promise<Record<string, unknown>> {
    const result = await this.health.getReadiness();
    if (result.status !== 'ok') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
