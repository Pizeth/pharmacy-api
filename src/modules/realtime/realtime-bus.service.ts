import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Client } from 'pg';
import { Subject } from 'rxjs';
import {
  parseRealtimeEvent,
  REALTIME_CHANNEL,
  resyncEvent,
  type RealtimeEvent,
} from './realtime.contract';

/** One dedicated LISTEN session per API replica; never a process-local publisher. */
@Injectable()
export class RealtimeBus implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeBus.name);
  private readonly events = new Subject<RealtimeEvent>();
  readonly notifications = this.events.asObservable();
  private client?: Client;
  private retry?: ReturnType<typeof setTimeout>;
  private stopping = false;
  private attempts = 0;
  ready = false;
  get enabled() {
    return process.env.REALTIME_ENABLED === 'true';
  }

  async onModuleInit() {
    if (!this.enabled) return;
    if (!process.env.REALTIME_DATABASE_URL) {
      throw new Error(
        'REALTIME_DATABASE_URL must be a dedicated direct/session connection, never a transaction pooler.',
      );
    }
    await this.connect();
  }

  private async connect() {
    if (this.stopping) return;
    const client = new Client({
      connectionString: process.env.REALTIME_DATABASE_URL,
      application_name: 'datatable-realtime',
      connectionTimeoutMillis: 10000,
      keepAlive: true,
    });
    this.client = client;
    let failed = false;
    const disconnected = () => {
      if (failed || this.stopping) return;
      failed = true;
      this.ready = false;
      // Clients reconnect and canonically refetch after every gap.
      this.events.next(resyncEvent());
      void client.end().catch(() => undefined);
      const delay = Math.min(30000, 1000 * 2 ** Math.min(this.attempts++, 5));
      this.retry = setTimeout(() => {
        void this.connect();
      }, delay);
      this.retry.unref();
      this.logger.warn(
        'Realtime database listener disconnected; reconnect scheduled.',
      );
    };
    client.on('error', disconnected);
    client.on('end', disconnected);
    client.on('notification', (message) => {
      if (
        client !== this.client ||
        !this.ready ||
        message.channel !== REALTIME_CHANNEL ||
        !message.payload
      )
        return;
      const event = parseRealtimeEvent(message.payload);
      if (event) this.events.next(event);
    });
    try {
      await client.connect();
      const triggers = await client.query<{
        count: number;
      }>(`SELECT count(*)::int AS count FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgenabled IN ('O', 'A') AND tgname IN
        ('translation_keys_live_v1', 'translation_values_live_v1', 'translation_categories_live_v1')`);
      if (triggers.rows[0]?.count !== 3)
        throw new Error('Realtime migration is not applied.');
      await client.query(`LISTEN ${REALTIME_CHANNEL}`);
      if (this.stopping || failed) {
        await client.end();
        return;
      }
      this.ready = true;
      this.attempts = 0;
      this.events.next(resyncEvent());
    } catch {
      disconnected();
    }
  }

  async onModuleDestroy() {
    this.stopping = true;
    this.ready = false;
    clearTimeout(this.retry);
    this.events.complete();
    await this.client?.end().catch(() => undefined);
  }
}
