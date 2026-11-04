import { jest } from '@jest/globals';
import { finishPostgresAcceptance } from '../../../scripts/realtime-postgres-cleanup.mjs';

const setup = () => ({
  writer: {
    query: jest
      .fn<(sql: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  },
  clients: Array.from({ length: 3 }, () => ({
    end: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  })),
  schema: 'live_test_disposable',
  schemaCreationAttempted: true,
});

it('does not queue cleanup SQL on a never-connected client and closes all clients', async () => {
  const f = setup(),
    original = new Error('connection failed');
  await expect(
    finishPostgresAcceptance({
      ...f,
      schemaCreationAttempted: false,
      failure: { error: original },
    }),
  ).rejects.toBe(original);
  expect(f.writer.query).not.toHaveBeenCalled();
  for (const client of f.clients) expect(client.end).toHaveBeenCalledTimes(1);
});

it('preserves the primary failure when schema cleanup and a client shutdown also fail', async () => {
  const f = setup(),
    original = new Error('primary failure');
  f.writer.query.mockRejectedValue(new Error('database unavailable'));
  f.clients[0].end.mockRejectedValue(new Error('shutdown failed'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    await expect(
      finishPostgresAcceptance({ ...f, failure: { error: original } }),
    ).rejects.toBe(original);
    for (const client of f.clients) expect(client.end).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('primary failure preserved'),
    );
  } finally {
    log.mockRestore();
  }
});

it('reports cleanup failure even after a successful proof and still closes every client', async () => {
  const f = setup();
  f.writer.query.mockRejectedValueOnce(new Error('rollback failed'));
  await expect(finishPostgresAcceptance(f)).rejects.toBeInstanceOf(
    AggregateError,
  );
  expect(f.writer.query).toHaveBeenCalledWith(
    'DROP SCHEMA IF EXISTS live_test_disposable CASCADE',
  );
  for (const client of f.clients) expect(client.end).toHaveBeenCalledTimes(1);
});

it('completes cleanly only after schema removal and all client shutdowns', async () => {
  const f = setup();
  await expect(finishPostgresAcceptance(f)).resolves.toBeUndefined();
  expect(f.writer.query).toHaveBeenNthCalledWith(1, 'ROLLBACK');
  expect(f.writer.query).toHaveBeenNthCalledWith(
    2,
    'DROP SCHEMA IF EXISTS live_test_disposable CASCADE',
  );
  for (const client of f.clients) expect(client.end).toHaveBeenCalledTimes(1);
});
