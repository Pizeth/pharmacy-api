import { Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';
import type { NextFunction, Request, Response } from 'express';

type Phase = 'policy' | 'rows' | 'count';
type Timing = Partial<Record<Phase, number>> & {
  started: number;
  beforePolicy?: number;
};

const requests = new AsyncLocalStorage<Timing>();
const logger = new Logger('TranslationQueryTiming');

export function translationQueryTiming(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (
    process.env.TRANSLATION_QUERY_TIMING !== 'true' ||
    request.method !== 'POST' ||
    request.path !== '/api/v1/i18n/keys/query'
  ) {
    next();
    return;
  }

  const timing: Timing = { started: performance.now() };
  response.once('finish', () => {
    const round = (ms: number | undefined) =>
      ms === undefined ? undefined : Math.round(ms);
    logger.log({
      status: response.statusCode,
      totalMs: round(performance.now() - timing.started),
      beforePolicyMs: round(timing.beforePolicy),
      policyMs: round(timing.policy),
      rowsMs: round(timing.rows),
      countMs: round(timing.count),
    });
  });
  requests.run(timing, next);
}

export async function timeTranslationQueryPhase<T>(
  phase: Phase,
  operation: () => PromiseLike<T>,
): Promise<T> {
  const timing = requests.getStore();
  if (!timing) return operation();

  const started = performance.now();
  if (phase === 'policy') timing.beforePolicy = started - timing.started;
  try {
    return await operation();
  } finally {
    timing[phase] = performance.now() - started;
  }
}
