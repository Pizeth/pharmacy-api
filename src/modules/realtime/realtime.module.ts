import { Module } from '@nestjs/common';
import { AuthorizationModule } from 'modules/authorization/authorization.module';
import { RealtimeAccess } from './realtime-access.service';
import { RealtimeBus } from './realtime-bus.service';
import { RealtimeController } from './realtime.controller';
import { ApplicationSocket } from './application-socket.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [RealtimeController],
  providers: [RealtimeBus, RealtimeAccess, ApplicationSocket],
})
export class RealtimeModule {}
