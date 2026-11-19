import {
  Controller,
  ForbiddenException,
  Get,
  Optional,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import type { Request, Response } from 'express';
import { Subscription, type Observable } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { DocumentTrackingService } from 'modules/document-tracking/document-tracking.service';
import type { DocumentRealtimeNotification } from './document-realtime.contract';
import { RealtimeAccess } from './realtime-access.service';
import { RealtimeBus } from './realtime-bus.service';
import { resyncEvent } from './realtime.contract';

@Controller({ path: 'live', version: '1' })
@UseGuards(AuthGuard)
export class RealtimeController {
  constructor(
    private readonly bus: RealtimeBus,
    private readonly access: RealtimeAccess,
    @Optional() private readonly documents?: DocumentTrackingService,
  ) {}

  @Get('translations')
  async translations(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    await this.openStream(
      request,
      response,
      this.bus.notifications,
      resyncEvent(),
      async (event) => {
        await this.access.assertRead(request.headers);
        return event;
      },
    );
  }

  @Get('tracked-documents')
  async trackedDocuments(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const documents = this.documents;
    if (process.env.DOCUMENT_REALTIME_ENABLED !== 'true' || !documents) {
      throw new ServiceUnavailableException(
        'Document realtime is not available.',
      );
    }
    await this.openStream<DocumentRealtimeNotification | null>(
      request,
      response,
      this.bus.documentNotifications,
      null,
      async (event) => {
        const user = await this.access.authenticatedUserId(request.headers);
        const allowed = await documents.canReceiveInvalidation(
          user,
          event ?? undefined,
        );
        if (!allowed || event === undefined) return undefined;
        return {
          version: 1,
          eventId: event?.eventId ?? randomUUID(),
          resource: 'tracked-documents',
          type: 'invalidate',
          occurredAt: event?.occurredAt ?? new Date().toISOString(),
        };
      },
    );
  }

  private async openStream<T>(
    request: Request,
    response: Response,
    events: Observable<T>,
    initial: T,
    authorize: (event?: T) => Promise<{ eventId: string } | undefined>,
  ): Promise<void> {
    if (!this.bus.enabled || !this.bus.ready)
      throw new ServiceUnavailableException('Realtime is not available.');
    const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:8080')
      .split(',')
      .map((value) => value.trim());
    if (request.headers.origin && !origins.includes(request.headers.origin))
      throw new ForbiddenException();
    await authorize();
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
    const send = (event?: T) => {
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
          const outbound = await authorize(event);
          if (event !== undefined && !outbound) return;
          if (closed) return;
          const frame = outbound
            ? `id: ${outbound.eventId}\ndata: ${JSON.stringify(outbound)}\n\n`
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
      events.subscribe({
        next: send,
        complete: () => close(),
      }),
    );
    send(initial);
  }
}
