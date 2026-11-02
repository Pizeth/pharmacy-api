/**
 * Always close every client, including after failed connection/schema cleanup.
 * @param {{writer: {query: (sql: string) => Promise<unknown>}, clients: {end: () => Promise<unknown>}[], schema: string, schemaCreated: boolean, failure?: {error: unknown}}} options
 */
export async function finishPostgresAcceptance(options) {
  const failures = [];
  try {
    // Never queue SQL on a client which may not have connected at all.
    if (options.schemaCreated) {
      try {
        await options.writer.query('ROLLBACK');
      } catch (error) {
        failures.push(error);
      }
      try {
        await options.writer.query(
          `DROP SCHEMA IF EXISTS ${options.schema} CASCADE`,
        );
      } catch (error) {
        failures.push(error);
      }
    }
  } finally {
    const results = await Promise.allSettled(
      options.clients.map((client) =>
        Promise.resolve().then(() => client.end()),
      ),
    );
    for (const result of results)
      if (result.status === 'rejected') failures.push(result.reason);
  }
  if (options.failure) {
    if (failures.length)
      console.error(
        `Acceptance cleanup encountered ${failures.length} error(s); primary failure preserved.`,
      );
    throw options.failure.error;
  }
  if (failures.length)
    throw new AggregateError(failures, 'Acceptance cleanup failed.');
}
