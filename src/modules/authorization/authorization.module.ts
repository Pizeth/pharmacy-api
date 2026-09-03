// src/modules/authorization/authorization.module.ts

import { Module } from '@nestjs/common';
import { PrismaModule } from 'modules/prisma/prisma.module';
import { CaslAbilityFactory } from './casl/casl-ability.factory';
import { PoliciesGuard } from './guards/policies.guard';

@Module({
  imports: [PrismaModule],
  providers: [CaslAbilityFactory, PoliciesGuard],
  exports: [CaslAbilityFactory, PoliciesGuard],
})
export class AuthorizationModule {}
