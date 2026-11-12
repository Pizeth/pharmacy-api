import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders, Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { Auth } from 'lib/auth';

export const APPLICATION_SOCKET_PATH = '/api/v1/socket.io';
const MAX_CONNECTION_MS = 5 * 60 * 1000;
type NoEvents = Record<never, never>;
type SocketSession = { connectionLifetime: number };

export function attachApplicationSocket(
  httpServer: HttpServer,
  allowedOrigins: readonly string[],
  authenticate: (headers: IncomingHttpHeaders) => Promise<Date | null>,
) {
  const io = new Server<NoEvents, NoEvents, NoEvents, SocketSession>(
    httpServer,
    {
      path: APPLICATION_SOCKET_PATH,
      transports: ['websocket'],
      serveClient: false,
      connectTimeout: 10_000,
      maxHttpBufferSize: 16 * 1024,
      allowRequest: (request, callback) => {
        const { origin } = request.headers;
        callback(null, Boolean(origin && allowedOrigins.includes(origin)));
      },
    },
  );

  io.use((socket, next) => {
    void authenticate(socket.request.headers)
      .then((expiresAt) => {
        const remaining = expiresAt ? expiresAt.getTime() - Date.now() : 0;
        if (!Number.isFinite(remaining) || remaining <= 0) {
          next(new Error('Unauthorized'));
          return;
        }
        socket.data.connectionLifetime = Math.min(remaining, MAX_CONNECTION_MS);
        next();
      })
      .catch(() => next(new Error('Unauthorized')));
  });

  io.on('connection', (socket) => {
    const lifetime = socket.data.connectionLifetime;
    const timeout = setTimeout(() => socket.disconnect(true), lifetime);
    timeout.unref();
    socket.once('disconnect', () => clearTimeout(timeout));
  });

  return () => {
    io.disconnectSockets(true);
    // Nest owns the HTTP server. Close only the Socket.IO transport here.
    io.engine.close();
  };
}

@Injectable()
export class ApplicationSocket
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private close?: () => void;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly auth: AuthService<Auth>,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.APPLICATION_SOCKET_ENABLED !== 'true') return;

    const origins = (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (!origins.length) {
      throw new Error('Application Socket.IO requires CORS_ORIGINS.');
    }
    const server = this.adapterHost.httpAdapter.getHttpServer() as HttpServer;
    this.close = attachApplicationSocket(server, origins, async (headers) => {
      const session = await this.auth.api.getSession({
        headers: fromNodeHeaders(headers),
        query: { disableCookieCache: true },
      });
      if (!session) return null;
      const { user } = session;
      if (
        user.isEnabled === false ||
        user.isLocked === true ||
        user.isActivated === false ||
        user.banned === true ||
        user.deletedAt
      )
        return null;
      return session.session.expiresAt;
    });
  }

  onModuleDestroy(): void {
    this.close?.();
    this.close = undefined;
  }
}
