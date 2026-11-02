import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import type { Request, Response } from 'express';
import { Subscription } from 'rxjs';
import { RealtimeAccess } from './realtime-access.service';
import { RealtimeBus } from './realtime-bus.service';
import { resyncEvent, type RealtimeEvent } from './realtime.contract';

@Controller({ path: 'live', version: '1' })
@UseGuards(AuthGuard)
export class RealtimeController {
  constructor(
    private readonly bus: RealtimeBus,
    private readonly access: RealtimeAccess,
  ) {}

  @Get('translations')
  async translations(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (!this.bus.enabled || !this.bus.ready)
      throw new ServiceUnavailableException('Realtime is not available.');
    const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:8080')
      .split(',')
      .map((value) => value.trim());
    if (request.headers.origin && !origins.includes(request.headers.origin))
      throw new ForbiddenException();
    await this.access.assertRead(request.headers);
    if (response.destroyed) return;
    if (!this.bus.enabled || !this.bus.ready)
      throw new ServiceUnavailableException('Realtime is not available.');
    let closed = false;
    let pending = 0;
    let queue = Promise.resolve();
    const timers: {
      heartbeat?: ReturnType<typeof setInterval>;
      lifetime?: ReturnType<typeof setTimeout>;
    } = {};
    const subscription = new Subscription();
    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(timers.heartbeat);
      clearTimeout(timers.lifetime);
      subscription.unsubscribe();
      response.end();
    };
    const send = (event?: RealtimeEvent) => {
      if (closed) return;
      if (++pending > 64) {
        close();
        return;
      }
      queue = queue
        .then(async () => {
          if (closed) return;
          if (!this.bus.ready) {
            close();
            return;
          }
          await this.access.assertRead(request.headers);
          if (closed) return;
          const frame = event
            ? `id: ${event.eventId}\ndata: ${JSON.stringify(event)}\n\n`
            : ': heartbeat\n\n';
          // Slow consumers reconnect instead of buffering unbounded protected data.
          if (!response.write(frame)) close();
        })
        .catch(close)
        .finally(() => {
          pending--;
        });
    };
    response.once('close', close);
    response.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders();
    if (closed) return;
    timers.heartbeat = setInterval(() => send(), 15000);
    timers.lifetime = setTimeout(close, 5 * 60000);
    subscription.add(
      this.bus.notifications.subscribe({
        next: send,
        complete: () => close(),
      }),
    );
    send(resyncEvent());
  }
}
