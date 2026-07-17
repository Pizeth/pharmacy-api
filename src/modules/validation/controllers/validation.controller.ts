// src/modules/validation/validation.controller.ts
import {
  Controller,
  Get,
  Param,
  VERSION_NEUTRAL,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ValidationService } from '../services/validation.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@AllowAnonymous()
@Controller({ path: 'validate', version: VERSION_NEUTRAL })
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @Get('email/:value')
  @HttpCode(HttpStatus.OK)
  async validateEmail(@Param('value') value: string) {
    return this.validationService.validateEmail(value);
  }

  @Get('username/:value')
  @HttpCode(HttpStatus.OK)
  async validateUsername(@Param('value') value: string) {
    return this.validationService.validateUsername(value);
  }

  @Get('officialId/:value')
  @HttpCode(HttpStatus.OK)
  async validateOfficialId(@Param('value') value: string) {
    return this.validationService.validateOfficialId(value);
  }
}
