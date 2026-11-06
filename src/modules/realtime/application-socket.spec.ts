import { jest } from '@jest/globals';
import { once } from 'node:events';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import { io, NodeWebSocket, type Socket } from 'socket.io-client';
import {
  APPLICATION_SOCKET_PATH,
  attachApplicationSocket,
} from './application-socket.service';

const trustedOrigin = 'https://hr.razeth.com';

it('checks the upgrade origin and authenticates the Socket.IO handshake', async () => {
  const server = createServer();
  const authenticate = jest.fn((headers: IncomingHttpHeaders) =>
    Promise.resolve(
      headers.cookie === 'session=valid' ? new Date(Date.now() + 60_000) : null,
    ),
  );
  const close = attachApplicationSocket(server, [trustedOrigin], authenticate);
  const clients: Socket[] = [];
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Expected TCP address');

    const connect = (origin: string, cookie?: string) => {
      const client = io(`http://127.0.0.1:${address.port}`, {
        path: APPLICATION_SOCKET_PATH,
        transports: [NodeWebSocket],
        reconnection: false,
        autoConnect: false,
        extraHeaders: { Origin: origin, ...(cookie && { Cookie: cookie }) },
      });
      clients.push(client);
      return client;
    };
    const rejected = (client: Socket) =>
      new Promise<Error>((resolve, reject) => {
        client.once('connect_error', resolve);
        client.once('connect', () =>
          reject(new Error('Unexpected connection')),
        );
        client.connect();
      });

    await rejected(connect('https://untrusted.example', 'session=valid'));
    expect(authenticate).not.toHaveBeenCalled();
    await expect(rejected(connect(trustedOrigin))).resolves.toMatchObject({
      message: 'Unauthorized',
    });
    const client = connect(trustedOrigin, 'session=valid');
    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
      client.connect();
    });
    expect(authenticate).toHaveBeenLastCalledWith(
      expect.objectContaining({ cookie: 'session=valid' }),
    );
    expect(client.connected).toBe(true);
  } finally {
    clients.forEach((client) => client.disconnect());
    close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
