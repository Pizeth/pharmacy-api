import { jest } from '@jest/globals';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthModule as BetterAuthModule,
  AuthService as BetterAuthService,
} from '@thallesp/nestjs-better-auth';
import type { Auth } from 'lib/auth';
import { PrismaService } from 'modules/prisma/services/prisma.service';
import { CaslAbilityFactory } from 'modules/authorization/casl/casl-ability.factory';
import { R2Service } from 'modules/files/services/cloudflare-r2.service';

@Module({
  providers: [{ provide: R2Service, useValue: {} }],
  exports: [R2Service],
})
class StubFileModule {
  // Nest uses this class as the module token.
}

jest.unstable_mockModule('modules/files/file.module', () => ({
  FileModule: StubFileModule,
}));
const { RealtimeModule } = await import('./realtime.module');
import { RealtimeAccess } from './realtime-access.service';

it('resolves the real globally configured async Better Auth provider across sibling modules with the gate off', async () => {
  const getSession = jest
    .fn<() => Promise<{ user: { id: string } }>>()
    .mockResolvedValue({ user: { id: '7' } });
  const auth = { api: { getSession }, options: {} } as unknown as Auth;
  // Same shape as application AuthModule: configured library import, no re-export.
  @Module({
    imports: [
      BetterAuthModule.forRootAsync({
        disableControllers: true,
        disableGlobalAuthGuard: true,
        useFactory: () => ({ auth }),
      }),
    ],
  })
  class ConfiguredAuthWrapper {}
  const module = await Test.createTestingModule({
    imports: [RealtimeModule, ConfiguredAuthWrapper],
  })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(CaslAbilityFactory)
    .useValue({ createForUser: () => Promise.resolve({ can: () => true }) })
    .compile();
  try {
    expect(module.get(BetterAuthService).instance).toBe(auth);
    await module.get(RealtimeAccess).assertRead({});
    expect(getSession).toHaveBeenCalledTimes(1);
  } finally {
    await module.close();
  }
});
