import { Module } from '@nestjs/common';
import { AuthorizationModule } from 'modules/authorization/authorization.module';
import { RealtimeAccess } from './realtime-access.service';
import { RealtimeBus } from './realtime-bus.service';
import { RealtimeController } from './realtime.controller';

@Module({
  imports: [AuthorizationModule],
  controllers: [RealtimeController],
  providers: [RealtimeBus, RealtimeAccess],
})
export class RealtimeModule {}
