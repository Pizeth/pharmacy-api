import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { V1Service } from '../services/v1.service';

@Controller({ path: '', version: '1' }) // 👈 Automatically adds /v1 via NestJS URI versioning
export class V1Controller {
  constructor(private readonly service: V1Service) {}

  @AllowAnonymous()
  @Get(['', '/']) // 👈 Matches BOTH /api/v1 AND /api/v1/ perfectly
  getV1Info() {
    return this.service.getInfo();
  }
}
